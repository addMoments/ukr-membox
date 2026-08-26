import { get_key, rm_key, set_key } from "../utils/persistence";

type ErrorBody = Record<string, unknown> | null;

export class FetchHttpError extends Error {
    status: number;
    body: ErrorBody;
    bodyText: string;

    constructor(message: string, status: number, bodyText: string, body: ErrorBody) {
        super(message);
        this.name = "FetchHttpError";
        this.status = status;
        this.bodyText = bodyText;
        this.body = body;
    }
}


export const isGuest = ()=>{
    const asd = window.location.pathname.startsWith("/guest/")
    return asd;
}

export const guestPackedEventUid = ()=>{
    const packedEventUid = window.location.pathname.split("/")[2];
    if (!packedEventUid){
        return "";
    }
    return packedEventUid;
}

const currentStorageKey = async ()=>{
    await updateCurrKey();
    return currKey;
}

// name a is self, otherwise packed event uid
export const getAuthToken = async (): Promise<string | null> => get_key(await currentStorageKey());
export const setAuthToken = async (token: string) => set_key(await currentStorageKey(), token);
export const clearAuthToken = async () => rm_key(await currentStorageKey());

let keyinitPromise: Promise<void> | null = null;
let currKey = "";
const updateCurrKey = async ()=>{
    if (keyinitPromise){
        return keyinitPromise;
    }

    keyinitPromise = (async () => {
        let hasAuthToken = false;
        let tkn = null;
        try {
            tkn = await get_key("tkn");
            hasAuthToken = !!tkn;
        } catch (err) {
            hasAuthToken = false;
        }
        currKey = hasAuthToken ? "tkn" : guestPackedEventUid();
    })();

    return keyinitPromise;
}

/**
 * Core fetch wrapper that handles:
 * - Authorization: Bearer header from stored JWT
 * - X-Auth-Token response header storage
 * - Error handling
 * - goto: redirect handling
 */
export const fetch = async (url: string, options: RequestInit = {}, config: { blockRedirects: boolean, pgrestcall?: boolean } = { blockRedirects: false, pgrestcall: false }): Promise<Response> => {
    const headers: Record<string, string> = (options.headers as Record<string, string>) || {};
    
    // Add Bearer token if we have one
    const token = await getAuthToken().catch(err => `err: ${err.message}`);

    if (token && !token.startsWith("err:")){
        headers["Authorization"] = `Bearer ${token}`;
    }

    const isGuestVar = isGuest();

    if (isGuestVar){
        headers["X-Event"] = guestPackedEventUid();
    }
    
    options.headers = headers;

    let res = await window.fetch(url, options);

    // Ne: Misafir sayfasinda event'e ozel saklanmis token gecersizse token'i silip
    //     istegi bir kez tokensiz tekrarlar.
    // Nasil: serv tokensiz misafir istegine yeni bir token uretiyor (AuthMiddleware
    //        "webanon.no-token" yolu), gecersiz token'a ise 401 donuyor.
    // Neden: Misafir token'inin omru 7 gun, event ise ~30 gun acik kaliyor. Token'i
    //        bayatlayan misafir her ziyarette 401 aliyordu; participant bootstrap bunu
    //        navigate("/404")'e cevirdigi icin link kalici olarak kirikmis gorunuyordu.
    // Not: Hesap token'i ("tkn") bu yolda silinmez -- oturumu sessizce kapatmamak icin.
    if (res.status === 401 && isGuestVar && headers["Authorization"] && currKey !== "tkn") {
        await clearAuthToken().catch(() => {});
        keyinitPromise = null;
        delete headers["Authorization"];
        options.headers = headers;
        res = await window.fetch(url, options);
    }

    if (!res.ok) {
        const bodyText = await res.text();
        let body: ErrorBody = null;
        try {
            body = JSON.parse(bodyText);
        } catch {
            body = null;
        }
        const message = typeof body?.message === "string"
            ? body.message
            : (bodyText || `Request failed with status ${res.status}`);
        throw new FetchHttpError(message, res.status, bodyText, body);
    }

    // Store new auth token if returned
    const newToken = res.headers.get("X-Auth-Token");
    if (newToken) {
        if (url.includes("signin") || url.includes("signup")) {
            await set_key("tkn", newToken);
        } else {
            await setAuthToken(newToken);
        }
        // Reset the key cache so the next request re-reads the stored token
        keyinitPromise = null;
        currKey = "tkn";
    }

    // Handle goto redirects
    if (res.status === 201 && !config.blockRedirects && !config.pgrestcall) {
        const gotolink = await res.text();
        if (gotolink.startsWith("goto:")) {
            window.location.href = gotolink.slice(5);
        }
    }

    return res;
};

