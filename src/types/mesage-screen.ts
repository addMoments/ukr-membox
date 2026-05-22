export type MessageScreenButton = {
  text: string;
  href: string;
};

export interface MessageScreen {
  title?: string | null;
  message?: string | null;
  subtext?: string | null;
  buttons?: MessageScreenButton[] | null;
  image?: string | null;
  warning?: string | null;
};

export const sendToMsg = (msg: MessageScreen) => {
  const b64Msg = btoa(JSON.stringify(msg));
  window.location.href = `/notice/${b64Msg}`;
}