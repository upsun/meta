const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// MODIFIEZ CES CHEMINS
const DATA_DIR = path.join(__dirname, '..', 'ressources');
const HISTORY_DIR = path.join(__dirname, '..', 'history'); // Même niveau que ressources

// Fonction pour obtenir le chemin de l'historique en préservant la structure
function getHistoryPath(filename) {
    return path.join(HISTORY_DIR, `${filename}.history.json`);
}

// Fonction pour créer récursivement les dossiers d'historique
async function ensureHistoryDir(filename) {
    const historyPath = getHistoryPath(filename);
    const historyDir = path.dirname(historyPath);
    await fs.mkdir(historyDir, { recursive: true });
}

// Créer les dossiers s'ils n'existent pas
async function ensureDirs() {
    try {
        // CRÉER HISTORY_DIR au démarrage
        await fs.mkdir(HISTORY_DIR, { recursive: true });
        console.log(`📁 Using data directory: ${DATA_DIR}`);
        console.log(`📜 Using history directory: ${HISTORY_DIR}`);
        console.log('✅ Directories ready');
    } catch (error) {
        console.error('Error creating directories:', error);
    }
}

// Middleware de sécurité pour valider les chemins
function validateFilePath(filename) {
    const normalized = path.normalize(filename);
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
        throw new Error('Invalid file path');
    }
    return normalized;
}

const addToHistory = (path, oldValue, newValue) => {
    const pathKey = getNodePath(path);
    const historyEntry = {
        timestamp: new Date().toISOString(),
        oldValue: JSON.stringify(oldValue, null, 2),
        newValue: JSON.stringify(newValue, null, 2),
        path: pathKey
    };

    setHistory(prev => ({
        ...prev,
        [pathKey]: [...(prev[pathKey] || []), historyEntry]
    }));
};

// Fonction pour lister les fichiers récursivement
async function listFilesRecursively(dir, baseDir = '') {
    const items = await fs.readdir(dir, { withFileTypes: true });
    const files = [];

    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        const relativePath = path.join(baseDir, item.name);

        if (item.isDirectory()) {
            const subFiles = await listFilesRecursively(fullPath, relativePath);
            files.push(...subFiles);
        } else if (item.isFile() && (item.name.endsWith('.json') || item.name.endsWith('.yaml') || item.name.endsWith('.yml'))) {
            files.push({
                name: relativePath.replace(/\\/g, '/'),
                type: item.name.endsWith('.json') ? 'json' : 'yaml',
                path: relativePath.replace(/\\/g, '/')
            });
        }
    }

    return files;
}

// Routes API
app.get('/api/files', async (req, res) => {
    try {
        const files = await listFilesRecursively(DATA_DIR);
        res.json(files);
    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/file/:filename(*)', async (req, res) => {
    try {
        const { filename } = req.params;
        const safeFilename = validateFilePath(filename);
        const filePath = path.join(DATA_DIR, safeFilename);
        const content = await fs.readFile(filePath, 'utf8');

        let data;
        if (filename.endsWith('.json')) {
            data = JSON.parse(content);
        } else {
            data = yaml.load(content) || {};
        }

        res.json({ data, type: filename.endsWith('.json') ? 'json' : 'yaml' });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'File not found' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

app.post('/api/file/:filename(*)', async (req, res) => {
    try {
        const { filename } = req.params;
        const safeFilename = validateFilePath(filename);
        const { data } = req.body;
        const filePath = path.join(DATA_DIR, safeFilename);

        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        let content;
        if (filename.endsWith('.json')) {
            content = JSON.stringify(data, null, 2);
        } else {
            content = yaml.dump(data, {
                indent: 2,
                lineWidth: -1,
                noRefs: true,
                skipInvalid: true
            });
        }

        await fs.writeFile(filePath, content);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/file', async (req, res) => {
    try {
        const { filename, type } = req.body;
        const safeFilename = validateFilePath(filename);
        const filePath = path.join(DATA_DIR, safeFilename);

        try {
            await fs.access(filePath);
            return res.status(400).json({ error: 'File already exists' });
        } catch (e) {
            // Le fichier n'existe pas, on peut le créer
        }

        let content;
        if (type === 'json') {
            content = '{}';
        } else {
            content = '# YAML file\n---\n{}';
        }

        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        await fs.writeFile(filePath, content);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/file/:filename(*)', async (req, res) => {
    try {
        const { filename } = req.params;
        const safeFilename = validateFilePath(filename);
        const filePath = path.join(DATA_DIR, safeFilename);
        await fs.unlink(filePath);

        // Supprimer aussi l'historique avec la structure préservée
        const historyPath = getHistoryPath(safeFilename);
        try {
            await fs.unlink(historyPath);
        } catch (e) {
            // Historique n'existe pas, pas grave
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lire l'historique d'un fichier
app.get('/api/history/:filename(*)', async (req, res) => {
    try {
        const { filename } = req.params;
        const safeFilename = validateFilePath(filename);
        const historyPath = getHistoryPath(safeFilename);

        try {
            const content = await fs.readFile(historyPath, 'utf8');
            res.json(JSON.parse(content));
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.json({});
            } else {
                throw error;
            }
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sauvegarder l'historique d'un fichier
app.post('/api/history/:filename(*)', async (req, res) => {
    try {
        const { filename } = req.params;
        const safeFilename = validateFilePath(filename);
        await ensureHistoryDir(safeFilename);
        const historyPath = getHistoryPath(safeFilename);
        await fs.writeFile(historyPath, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload d'un fichier
app.post('/api/upload/:filename(*)', async (req, res) => {
    try {
        const { filename } = req.params;
        const safeFilename = validateFilePath(filename);
        const { data } = req.body;
        const filePath = path.join(DATA_DIR, safeFilename);

        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        let content;
        if (filename.endsWith('.json')) {
            content = JSON.stringify(data, null, 2);
        } else {
            content = yaml.dump(data, { indent: 2, lineWidth: -1 });
        }

        await fs.writeFile(filePath, content);

        // Réinitialiser l'historique
        await ensureHistoryDir(safeFilename);
        const historyPath = getHistoryPath(safeFilename);
        await fs.writeFile(historyPath, JSON.stringify({}, null, 2));

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ajouter un nœud à la racine
app.post('/api/file/:filename(*)/add', async (req, res) => {
    try {
        const { filename } = req.params;
        const safeFilename = validateFilePath(filename);
        const { key, value } = req.body;

        if (!key || key.trim() === '') {
            return res.status(400).json({ error: 'Key is required' });
        }

        const filePath = path.join(DATA_DIR, safeFilename);
        const historyPath = getHistoryPath(safeFilename);

        // Lire le fichier source
        const content = await fs.readFile(filePath, 'utf8');

        let data;
        if (filename.endsWith('.json')) {
            data = JSON.parse(content);
        } else {
            data = yaml.load(content) || {};
        }

        if (typeof data !== 'object' || Array.isArray(data)) {
            return res.status(400).json({ error: 'Root must be an object' });
        }

        if (data[key] !== undefined) {
            return res.status(400).json({ error: 'Key already exists at root' });
        }

        data[key] = value;

        let newContent;
        if (filename.endsWith('.json')) {
            newContent = JSON.stringify(data, null, 2);
        } else {
            newContent = yaml.dump(data, { indent: 2, lineWidth: -1 });
        }

        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, newContent);

        // Mettre à jour l'historique
        let history = {};
        try {
            const h = await fs.readFile(historyPath, 'utf8');
            history = JSON.parse(h);
        } catch (e) {
            // Pas d'historique existant → OK
        }

        const entry = {
            timestamp: new Date().toISOString(),
            oldValue: null,
            newValue: JSON.stringify(value, null, 2),
            path: key
        };

        history[key] = [...(history[key] || []), entry];

        await ensureHistoryDir(safeFilename);
        await fs.writeFile(historyPath, JSON.stringify(history, null, 2));

        res.json({ success: true, data });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export d'un fichier
app.get('/api/export/:filename(*)', async (req, res) => {
    try {
        const { filename } = req.params;
        const safeFilename = validateFilePath(filename);
        const filePath = path.join(DATA_DIR, safeFilename);

        const content = await fs.readFile(filePath, 'utf8');

        let mimeType;
        if (filename.endsWith('.json')) {
            mimeType = 'application/json';
        } else {
            mimeType = 'text/yaml';
        }

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(content);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Démarrer le serveur
ensureDirs().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Multi-File Editor running on http://localhost:${PORT}`);
        console.log(`📁 Data files in: ${DATA_DIR}`);
        console.log(`📜 History files in: ${HISTORY_DIR}`);
    });
});