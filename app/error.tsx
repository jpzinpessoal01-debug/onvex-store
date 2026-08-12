"use client";
export default function GlobalError({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main className="simple-auth page-dark"><div><p className="eyebrow">ALGO SAIU DO CONTROLE</p><h1>NÃO FOI POSSÍVEL<br/>CARREGAR.</h1><p>O problema foi registrado sem expor detalhes internos. Tente novamente.</p><button className="button button--silver" onClick={reset}>TENTAR NOVAMENTE</button></div></main>}

