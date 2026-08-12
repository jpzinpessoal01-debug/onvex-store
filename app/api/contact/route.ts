import { getDb } from "@/db";
import { contactMessages } from "@/db/schema";
import { cleanText, enforceSameOrigin, errorResponse, normalizeEmail, optionalText } from "@/lib/errors";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
export async function POST(request:Request){try{enforceSameOrigin(request);await enforceRateLimit(`contact:${requestIp(request)}`,5,60*60);const input=await request.json() as Record<string,unknown>;const db=await getDb();const[message]=await db.insert(contactMessages).values({name:cleanText(input.name,"Nome",150),email:normalizeEmail(input.email),phone:optionalText(input.phone,30),subject:cleanText(input.subject,"Assunto",100),message:cleanText(input.message,"Mensagem",3000)}).returning();return Response.json({id:message.id},{status:201});}catch(error){return errorResponse(error);}}

