import express from 'express';
import { createServer as createViteServer } from 'vite';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extractFolderId(input: string): string {
  if (!input) return '';
  const match = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const matchId = input.match(/id=([a-zA-Z0-9_-]+)/);
  if (matchId) return matchId[1];
  return input.trim();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Routes
  app.get('/api/drive-folders', async (req, res) => {
    try {
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const rawFolderId = process.env.DRIVE_FOLDER_ID || '16M436N3T16wjlj-yV8YOrwddkdWwCYDx';
      const folderId = rawFolderId ? extractFolderId(rawFolderId) : undefined;

      if (!clientEmail || !privateKey || !folderId) {
        return res.status(501).json({ error: 'Google Drive credentials not configured.' });
      }

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });

      const drive = google.drive({ version: 'v3', auth });

      const response = await drive.files.list({
        q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, createdTime, webViewLink)',
        orderBy: 'createdTime desc',
      });

      res.json({ files: response.data.files || [] });
    } catch (error: any) {
      // Check if the error is because the API is disabled
      if (error.message && error.message.includes('has not been used in project')) {
        return res.status(403).json({ 
          error: 'API_DISABLED', 
          message: 'Google Drive API is not enabled for this project.' 
        });
      }

      // Check if the folder is not found or invalid
      if (error.message && error.message.includes('File not found')) {
        return res.status(404).json({
          error: 'FOLDER_NOT_FOUND',
          message: 'The specified Google Drive folder ID was not found or the service account lacks access.'
        });
      }

      console.error('Drive API Error:', error.message || error);
      res.status(500).json({ error: 'Failed to fetch folders from Google Drive' });
    }
  });

  app.get('/api/drive-files/:folderId', async (req, res) => {
    try {
      const { folderId } = req.params;
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      
      if (!clientEmail || !privateKey) {
        return res.status(501).json({ error: 'Google Drive credentials not configured.' });
      }

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });

      const drive = google.drive({ version: 'v3', auth });

      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, webViewLink, thumbnailLink, createdTime)',
        orderBy: 'createdTime desc',
      });

      res.json({ files: response.data.files || [] });
    } catch (error: any) {
      // Check if the folder is not found or invalid
      if (error.message && error.message.includes('File not found')) {
        return res.status(404).json({
          error: 'FOLDER_NOT_FOUND',
          message: 'The specified Google Drive folder ID was not found or the service account lacks access.'
        });
      }

      console.error('Drive API Error (Files):', error.message || error);
      res.status(500).json({ error: 'Failed to fetch files from Google Drive' });
    }
  });

  app.get('/api/drive-download/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      
      if (!clientEmail || !privateKey) {
        return res.status(501).json({ error: 'Google Drive credentials not configured.' });
      }

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });

      const drive = google.drive({ version: 'v3', auth });

      // Get file metadata to check mimeType
      const fileMeta = await drive.files.get({ fileId, fields: 'mimeType, name' });
      const mimeType = fileMeta.data.mimeType || '';

      // If it's a Google Workspace document, we need to export it
      if (mimeType.startsWith('application/vnd.google-apps.')) {
        let exportMimeType = 'application/pdf'; // Default export to PDF
        if (mimeType === 'application/vnd.google-apps.document') exportMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (mimeType === 'application/vnd.google-apps.spreadsheet') exportMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        else if (mimeType === 'application/vnd.google-apps.presentation') exportMimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

        const response = await drive.files.export(
          { fileId, mimeType: exportMimeType },
          { responseType: 'stream' }
        );
        response.data.pipe(res);
      } else {
        // Regular file download
        const response = await drive.files.get(
          { fileId, alt: 'media' },
          { responseType: 'stream' }
        );
        response.data.pipe(res);
      }
    } catch (error: any) {
      console.error('Drive API Error (Download):', error.message || error);
      res.status(500).json({ error: 'Failed to download file from Google Drive' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
