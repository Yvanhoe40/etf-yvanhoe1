export async function GET() {
  return Response.json({
    status: "ok",
    hasApiKey: !!process.env.TWELVE_DATA_API_KEY,
  });
}