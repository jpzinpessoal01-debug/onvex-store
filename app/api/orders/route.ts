import { createOrder, type CheckoutInput } from "@/lib/checkout";
import { enforceSameOrigin, errorResponse } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const payload = await request.json() as CheckoutInput;
    const result = await createOrder(payload);
    return Response.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
