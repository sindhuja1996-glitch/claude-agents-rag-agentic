import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase();

    // For plain text types, just decode and return
    const textExts = [
      'txt','md','mdx','ts','tsx','js','jsx','py','java','go',
      'rs','cpp','c','cs','rb','php','swift','kt','json','yaml',
      'yml','toml','sh','bash','sql','html','css','scss','xml','csv',
    ];

    if (textExts.includes(ext ?? '')) {
      const text = await file.text();
      return NextResponse.json({ text });
    }

    if (ext === 'pdf') {
      // Dynamically import pdf-parse only when needed
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const buffer = Buffer.from(await file.arrayBuffer());
        const data = await pdfParse(buffer);
        return NextResponse.json({ text: data.text });
      } catch {
        return NextResponse.json(
          { error: 'pdf-parse not installed. Run: npm install pdf-parse @types/pdf-parse' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: `Unsupported file type: .${ext}` }, { status: 400 });
  } catch (err) {
    console.error('Extract text error:', err);
    return NextResponse.json({ error: 'Failed to extract text' }, { status: 500 });
  }
}
