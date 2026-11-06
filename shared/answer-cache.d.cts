declare const cache: {
  signature(question: string): string | null;
  contextKey(memories: any[], enabled?: boolean): string;
  makeMeta(question: string, reply: string, mode: string, memories: any[], enabled?: boolean, now?: number): any;
  pairs(messages: any[]): { question: any; answer: any }[];
  find(question: string, messages: any[], memories: any[], enabled?: boolean, now?: number): { question: any; answer: any; exact: boolean } | null;
  ttl: number;
};
export = cache;
