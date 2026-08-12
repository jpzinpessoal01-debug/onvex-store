import { getRuntimeEnv } from "@/lib/runtime-env";
type RuntimeEnv={BUCKET?:R2Bucket};
type Params=Promise<{key:string[]}>;
export async function GET(_request:Request,{params}:{params:Params}){const{key:parts}=await params;if(!parts.length||parts.some((part)=>part===".."))return new Response("Not found",{status:404});const key=parts.join("/");const runtime=await getRuntimeEnv<RuntimeEnv>();if(!runtime.BUCKET)return new Response("Not found",{status:404});const object=await runtime.BUCKET.get(key);if(!object)return new Response("Not found",{status:404});const headers=new Headers();object.writeHttpMetadata(headers);headers.set("etag",object.httpEtag);headers.set("x-content-type-options","nosniff");return new Response(object.body,{headers});}
