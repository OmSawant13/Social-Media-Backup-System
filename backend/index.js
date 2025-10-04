const functions = require('firebase-functions');
const { MongoClient, ObjectId, GridFSBucket } = require('mongodb');
const cors = require('cors')({ origin: true });
const multer = require('multer');

// MongoDB connection
const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'SocialMedia';
const COLLECTION_NAME = 'Backup';

let db, collection, bucket;

// Initialize MongoDB connection
async function connectToMongoDB() {
    try {
        const client = new MongoClient(MONGO_URL);
        await client.connect();
        db = client.db(DB_NAME);
        collection = db.collection(COLLECTION_NAME);
        bucket = new GridFSBucket(db, { bucketName: 'files' });
        console.log('✅ MongoDB connected successfully!');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
    }
}

// Initialize connection
connectToMongoDB();

// Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Health check
exports.health = functions.https.onRequest((req, res) => {
    return cors(req, res, () => {
        res.json({
            status: 'OK',
            message: 'Social Media Backup API is running!',
            timestamp: new Date().toISOString()
        });
    });
});

// Upload backup
exports.backup = functions.https.onRequest((req, res) => {
    return cors(req, res, async() => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        try {
            const { userId, caption, mood } = req.body;

            if (!userId) {
                return res.status(400).json({ error: 'User ID required' });
            }

            // Handle file upload
            upload.single('file')(req, res, async(err) => {
                if (err) {
                    return res.status(400).json({ error: 'File upload error' });
                }

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
                    const fileUrl = `https://us-central1-rdsem-a00a4.cloudfunctions.net/files/${fileId}`;

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
                        message: 'File uploaded successfully',
                        fileId: fileId,
                        fileUrl: fileUrl
                    });
                });

                uploadStream.on('error', (error) => {
                    console.error('❌ Upload error:', error);
                    res.status(500).json({ error: 'Upload failed' });
                });
            });
        } catch (error) {
            console.error('❌ Backup error:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// Get backups
exports.getBackups = functions.https.onRequest((req, res) => {
    return cors(req, res, async() => {
        try {
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({
                    error: 'User ID required for security',
                    message: 'Cannot access data without user authentication'
                });
            }

            const data = await collection.find({ userId: userId }).sort({ uploadedAt: -1 }).toArray();
            console.log('📊 Data retrieved from MongoDB for user', userId + ':', data.length, 'documents');
            res.json(data);
        } catch (error) {
            console.error('❌ Fetch error:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// Serve files
exports.files = functions.https.onRequest((req, res) => {
    return cors(req, res, async() => {
        try {
            const fileId = req.params[0];

            if (!fileId) {
                return res.status(400).json({ error: 'File ID required' });
            }

            const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));

            downloadStream.on('error', (error) => {
                console.error('❌ File serve error:', error);
                res.status(404).json({ error: 'File not found' });
            });

            // Get file info for proper headers
            const fileInfo = await bucket.find({ _id: new ObjectId(fileId) }).toArray();
            if (fileInfo.length > 0) {
                const file = fileInfo[0];
                res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
                res.setHeader('Content-Type', file.metadata ? mimeType || 'application/octet-stream');
            }

            downloadStream.pipe(res);
        } catch (error) {
            console.error('❌ File serve error:', error);
            res.status(500).json({ error: error.message });
        }
    });
});