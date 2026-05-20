import { supabase } from './_supabase.js';

function readBody(req) {
  return new Promise(function(resolve, reject) {
    var data = '';
    req.on('data', function(c) { data += c; });
    req.on('end', function() {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch(e) { reject(e); }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') return res.status(405).end();

  var body = await readBody(req);
  var { data: dataUrl, name } = body;

  if (!dataUrl) return res.status(400).json({ error: 'No image data' });

  /* strip base64 prefix: "data:image/png;base64,..." */
  var matches = dataUrl.match(/^data:([a-zA-Z/]+);base64,(.+)$/);
  if (!matches) return res.status(400).json({ error: 'Invalid image format' });

  var mimeType = matches[1];
  var base64   = matches[2];
  var buffer   = Buffer.from(base64, 'base64');

  /* enforce 3MB limit server-side */
  if (buffer.length > 3 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image exceeds 3MB limit' });
  }

  var ext      = (name || 'screenshot').split('.').pop().toLowerCase() || 'png';
  var filename = Date.now() + '.' + ext;

  var { error } = await supabase.storage
    .from('trade-screenshots')
    .upload(filename, buffer, { contentType: mimeType, upsert: false });

  if (error) return res.status(500).json({ error: error.message });

  var { data: urlData } = supabase.storage
    .from('trade-screenshots')
    .getPublicUrl(filename);

  return res.json({ url: urlData.publicUrl });
}
