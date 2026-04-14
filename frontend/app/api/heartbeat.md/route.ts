import { NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';

export async function GET() {
  const heartbeatMd = `# DerivArena — status

**Last updated:** ${new Date().toISOString()}

Use this file as a lightweight health reference for agents and automation.

---

## System checks

\`\`\`bash
curl -s ${API}/health
\`\`\`

---

## API

Set \`NEXT_PUBLIC_API_URL\` to your DerivArena Go API (default in development: \`http://localhost:8090\`).

Official Deriv documentation: https://developers.deriv.com/docs

---

**Next check:** whenever you deploy or change infrastructure.
`;

  return new NextResponse(heartbeatMd, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
