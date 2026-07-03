import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { label, image } = await request.json();
    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Clean base64 prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const dir = path.join(process.cwd(), 'public', 'captured_frames');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Use a clean label name
    const cleanLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${cleanLabel}_${Date.now()}.png`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, buffer);

    console.log(`[API] Saved frame to: ${filepath}`);
    return NextResponse.json({ success: true, filename, filepath: `/captured_frames/${filename}` });
  } catch (error: any) {
    console.error('[API] Error saving frame:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
