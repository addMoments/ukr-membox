import { DB_ROOT } from "../consts";
import { fetch } from "./core";

export const pgREST = async (query: string, options?: RequestInit, root?: string)=>{
    options = options || {};
    options.method = options.method || "GET";
    options.headers = options.headers || {};
    (options.headers as Record<string, string>)["Content-Type"] = (options.headers as Record<string, string>)["Content-Type"] || "application/json";

    const res = await fetch(`${root || DB_ROOT}${query}`, options, { pgrestcall: true, blockRedirects: false })
    if (!res){
        return ""
    }
    const data = await res.text();
    if (data.startsWith("{") || data.startsWith("[")){
        return JSON.parse(data);
    }

    return data;
}

export const pgErr = async (query: string, options?: RequestInit, root?: string)=>{
    let err: Error | null = null;
    let res: any = null;

    await pgREST(query, options, root)
        .then(r => {
            res = r
        })
        .catch(e => {
            let msg: string = e.message;
            try {
                const parsed = JSON.parse(msg);
                if (parsed?.message) msg = parsed.message;
            } catch {}
            err = new Error(msg);
        });
        
    return {res, err};
}