import { and, eq } from "drizzle-orm";
import { getDb, getRawDb } from "@/db";
import { addresses } from "@/db/schema";
import { requireUserApi } from "@/lib/auth";
import { assertInteger, cleanText, enforceSameOrigin, errorResponse, optionalText } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await requireUserApi();
    const input = await request.json() as Record<string, unknown>;
    const values = {
      userId: user.id,
      label: cleanText(input.label ?? "Principal", "Identificação", 50),
      recipientName: cleanText(input.recipientName, "Destinatário", 150),
      postalCode: cleanText(input.postalCode, "CEP", 12),
      street: cleanText(input.street, "Rua", 180),
      number: cleanText(input.number, "Número", 20),
      complement: optionalText(input.complement, 100),
      district: cleanText(input.district, "Bairro", 100),
      city: cleanText(input.city, "Cidade", 100),
      state: cleanText(input.state, "Estado", 2).toUpperCase(),
      isDefault: input.isDefault === true,
    };
    if (!/^\d{5}-?\d{3}$/.test(values.postalCode)) return Response.json({ error: "CEP inválido." }, { status: 400 });
    const raw = await getRawDb();
    const statements: D1PreparedStatement[] = [];
    if (values.isDefault) statements.push(raw.prepare("UPDATE addresses SET is_default=0,updated_at=? WHERE user_id=?").bind(new Date().toISOString(), user.id));
    statements.push(raw.prepare("INSERT INTO addresses (user_id,label,recipient_name,postal_code,street,number,complement,district,city,state,is_default,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(values.userId, values.label, values.recipientName, values.postalCode, values.street, values.number, values.complement, values.district, values.city, values.state, values.isDefault ? 1 : 0, new Date().toISOString(), new Date().toISOString()));
    await raw.batch(statements);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await requireUserApi();
    const input = await request.json() as Record<string, unknown>;
    const db = await getDb();
    await db.delete(addresses).where(and(eq(addresses.id, assertInteger(input.id, "Endereço")), eq(addresses.userId, user.id)));
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
