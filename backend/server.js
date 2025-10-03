const express = require('express');
const { MongoClient, ObjectId, GridFSBucket } = require('mongodb');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = 3000;

// MongoDB connection
const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'SocialMedia';
const COLLECTION_NAME = 'Backup';

let db, collection, bucket;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        const client = new MongoClient(MONGO_URL);
        await client.connect();
        db = client.db(DB_NAME);
        collection = db.collection(COLLECTION_NAME);
        bucket = new GridFSBucket(db, { bucketName: 'files' });

        // Create indexes for better performance
        await createIndexes();

        console.log('✅ MongoDB connected successfully!');
        console.log('📁 GridFS bucket initialized for file storage');
        console.log('🚀 Performance indexes created!');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
    }
}

// Create indexes for better performance
async function createIndexes() {
    try {
        // Index on userId for fast user queries
        await collection.createIndex({ userId: 1 });
        console.log('📊 Index created: userId');

        // Index on type for fast type queries
        await collection.createIndex({ type: 1 });
        console.log('📊 Index created: type');

        // Index on uploadedAt for fast sorting
        await collection.createIndex({ uploadedAt: -1 });
        console.log('📊 Index created: uploadedAt (descending)');

        // Compound index for user + type queries
        await collection.createIndex({ userId: 1, type: 1 });
        console.log('📊 Index created: userId + type (compound)');

        // Index on fileId for fast file lookups
        await collection.createIndex({ fileId: 1 });
        console.log('📊 Index created: fileId');

        // Index on mimeType for file type filtering
        await collection.createIndex({ mimeType: 1 });
        console.log('📊 Index created: mimeType');

        console.log('🎯 All performance indexes created successfully!');
    } catch (error) {
        console.error('❌ Index creation failed:', error);
    }
}

// API Routes

// Upload file to GridFS and save metadata
app.post('/api/backup', upload.single('file'), async(req, res) => {
    try {
        const { userId, caption, mood } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Upload file to GridFS
        const uploadStream = bucket.openUploadStream(file.originalname, {
            metadata: {
                userId: userId,
                caption: caption,
                mimeType: file.mimetype
            }
        });

        uploadStream.end(file.buffer);

        uploadStream.on('finish', async() => {
            const fileId = uploadStream.id;
            const fileUrl = `http://localhost:3000/api/files/${fileId}`;

            // Save metadata to collection
            const result = await collection.insertOne({
                type: 'backup',
                userId: userId,
                fileName: file.originalname,
                fileSize: file.size,
                mimeType: file.mimetype,
                caption: caption,
                mood: mood || 'neutral',
                fileId: fileId,
                fileUrl: fileUrl,
                uploadedAt: new Date()
            });

            console.log('📁 File uploaded to GridFS:', fileId);
            console.log('📊 Metadata saved:', result.insertedId);
            res.json({
                success: true,
                id: result.insertedId,
                fileId: fileId,
                fileUrl: fileUrl
            });
        });

    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get data from MongoDB - SECURITY FIX: Only return current user's data
app.get('/api/backup', async(req, res) => {
    try {
        const query = req.query;
        const userId = query.userId;

        // SECURITY: Must provide userId to prevent data leakage
        if (!userId) {
            return res.status(400).json({
                error: 'User ID required for security',
                message: 'Cannot access data without user authentication'
            });
        }

        // Convert string query to proper MongoDB query
        const mongoQuery = { userId: userId }; // Only current user's data
        if (query.type) mongoQuery.type = query.type;
        if (query._id) mongoQuery._id = new ObjectId(query._id);

        const data = await collection.find(mongoQuery).sort({ uploadedAt: -1 }).toArray();
        console.log('📊 Data retrieved from MongoDB for user', userId + ':', data.length, 'documents');
        res.json(data);
    } catch (error) {
        console.error('❌ Fetch error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single document by ID
app.get('/api/backup/:id', async(req, res) => {
    try {
        const id = req.params.id;
        const data = await collection.findOne({ _id: new ObjectId(id) });
        console.log('📄 Single document retrieved:', data ? 'Found' : 'Not found');
        res.json(data);
    } catch (error) {
        console.error('❌ Single fetch error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve files from GridFS
app.get('/api/files/:fileId', async(req, res) => {
    try {
        const fileId = req.params.fileId;
        const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));

        downloadStream.on('error', (error) => {
            console.error('❌ File download error:', error);
            res.status(404).json({ error: 'File not found' });
        });

        // Get file info for proper headers
        const fileInfo = await bucket.find({ _id: new ObjectId(fileId) }).toArray();
        if (fileInfo.length > 0) {
            const file = fileInfo[0];
            res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
            res.setHeader('Content-Type', file.metadata ? .mimeType || 'application/octet-stream');
        }

        downloadStream.pipe(res);
    } catch (error) {
        console.error('❌ File serve error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clear all data (for testing)
app.delete('/api/backup', async(req, res) => {
    try {
        await collection.deleteMany({});
        await bucket.drop();
        console.log('🗑️ All data cleared from MongoDB');
        res.json({ success: true, message: 'All data cleared' });
    } catch (error) {
        console.error('❌ Clear error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        mongodb: collection ? 'Connected' : 'Disconnected',
        gridfs: bucket ? 'Ready' : 'Not Ready',
        timestamp: new Date().toISOString()
    });
});

// Get index information
app.get('/api/indexes', async(req, res) => {
    try {
        const indexes = await collection.indexes();
        console.log('📊 Index information retrieved');
        res.json({
            success: true,
            indexes: indexes,
            count: indexes.length
        });
    } catch (error) {
        console.error('❌ Index info error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
async function startServer() {
    await connectToMongoDB();

    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📊 MongoDB: ${MONGO_URL}/${DB_NAME}/${COLLECTION_NAME}`);
        console.log(`🔗 API Endpoints:`);
        console.log(`   POST /api/backup - Save data`);
        console.log(`   GET  /api/backup - Get all data`);
        console.log(`   GET  /api/backup/:id - Get single document`);
        console.log(`   GET  /api/health - Health check`);
        console.log(`   GET  /api/indexes - Get index information`);
    });
}

startServer();