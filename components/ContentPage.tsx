import type { ReactNode } from "react";
export function ContentPage({eyebrow,title,intro,children}:{eyebrow:string;title:string;intro:string;children:ReactNode}){return <main className="content-page page-dark"><header className="container"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{intro}</p></header><article className="container content-body">{children}</article></main>}

