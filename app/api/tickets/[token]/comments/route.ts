import { NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  readJsonBody,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { commentSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;

    const { content, authorType } = commentSchema.parse(body.data);

    const ticket = await prisma.ticket.findUnique({ where: { token }, select: { id: true } });
    if (!ticket) {
      return jsonError("Ticket non trovato", 404);
    }

    const comment = await prisma.comment.create({
      data: {
        ticketId: ticket.id,
        author: authorType,
        content,
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
