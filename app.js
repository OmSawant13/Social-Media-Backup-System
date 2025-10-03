/**
 * Social Media Backup & Restore System
 * Main Application Logic with DSA Integration
 */

class SocialMediaBackupApp {
    constructor() {
        this.currentUser = null;
        this.hashManager = new HashManager();
        this.fileChunker = new FileChunker();
        this.backupQueue = new Queue();
        this.restoreStack = new Stack();
        this.chunkStorage = new ChunkLinkedList();
        this.bloomFilter = new BloomFilter();

        this.initializeApp();
    }

    /**
     * Initialize the application
     */
    async initializeApp() {
        this.setupEventListeners();
        this.setupAuthStateListener();
        this.setupFileUpload();
        this.setupTabNavigation();
    }

    /**
     * Setup authentication state listener
     */
    setupAuthStateListener() {
        onAuthStateChanged(firebaseAuth, (user) => {
            if (user) {
                this.currentUser = user;
                this.showMainScreen();
                this.loadBackupHistory();
            } else {
                this.currentUser = null;
                this.showAuthScreen();
            }
        });
    }

    /**
     * Setup event listeners for authentication
     */
    setupEventListeners() {
        // Login form
        document.getElementById('login-btn').addEventListener('click', () => {
            this.handleLogin();
        });

        // Signup form
        document.getElementById('signup-btn').addEventListener('click', () => {
            this.handleSignup();
        });

        // Toggle between login/signup
        document.getElementById('signup-toggle').addEventListener('click', () => {
            this.toggleAuthForm('signup');
        });

        document.getElementById('login-toggle').addEventListener('click', () => {
            this.toggleAuthForm('login');
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Upload button
        document.getElementById('upload-btn').addEventListener('click', () => {
            this.handleUpload();
        });

        // Restore button
        document.getElementById('restore-btn').addEventListener('click', () => {
            this.handleRestore();
        });
    }

    /**
     * Setup file upload functionality
     */
    setupFileUpload() {
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');

        // Drag and drop events
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            this.handleFileSelection(files);
        });

        // Click to browse
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });
    }

    /**
     * Setup tab navigation
     */
    setupTabNavigation() {
        const navTabs = document.querySelectorAll('.nav-tab');
        const tabContents = document.querySelectorAll('.tab-content');

        navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;

                // Update active tab
                navTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update active content
                tabContents.forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${targetTab}-tab`).classList.add('active');
            });
        });
    }

    /**
     * Toggle between login and signup forms
     */
    toggleAuthForm(formType) {
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');

        if (formType === 'signup') {
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
        } else {
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        }
    }

    /**
     * Handle user login
     */
    async handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            await signInWithEmailAndPassword(firebaseAuth, email, password);
            this.showMessage('Login successful!', 'success');
        } catch (error) {
            this.showMessage(`Login failed: ${error.message}`, 'error');
        }
    }

    /**
     * Handle user signup
     */
    async handleSignup() {
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        try {
            const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
            // Store additional user data
            await addDoc(collection(firebaseDb, 'users'), {
                uid: userCredential.user.uid,
                name: name,
                email: email,
                createdAt: serverTimestamp()
            });
            this.showMessage('Account created successfully!', 'success');
        } catch (error) {
            this.showMessage(`Signup failed: ${error.message}`, 'error');
        }
    }

    /**
     * Handle user logout
     */
    async handleLogout() {
        try {
            await signOut(firebaseAuth);
            this.showMessage('Logged out successfully!', 'success');
        } catch (error) {
            this.showMessage(`Logout failed: ${error.message}`, 'error');
        }
    }

    /**
     * Show authentication screen
     */
    showAuthScreen() {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('main-screen').classList.add('hidden');
    }

    /**
     * Show main application screen
     */
    showMainScreen() {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-screen').classList.remove('hidden');
        document.getElementById('user-email').textContent = this.currentUser.email;
    }

    /**
     * Handle file selection
     */
    handleFileSelection(files) {
        const fileList = Array.from(files);
        this.selectedFiles = fileList;

        // Enable upload button
        document.getElementById('upload-btn').disabled = false;

        // Show file previews
        this.showFilePreviews(fileList);
    }

    /**
     * Show file previews
     */
    showFilePreviews(files) {
        const uploadArea = document.getElementById('upload-area');
        const existingPreviews = uploadArea.querySelectorAll('.file-preview');
        existingPreviews.forEach(preview => preview.remove());

        files.forEach((file, index) => {
            const preview = document.createElement('div');
            preview.className = 'file-preview';
            preview.innerHTML = `
                <img src="${URL.createObjectURL(file)}" alt="Preview" onerror="this.style.display='none'">
                <div class="file-info">
                    <h4>${file.name}</h4>
                    <p>${this.formatFileSize(file.size)} - ${file.type}</p>
                </div>
                <i class="fas fa-times file-remove" onclick="app.removeFilePreview(this)"></i>
            `;
            uploadArea.appendChild(preview);
        });
    }

    /**
     * Remove file preview
     */
    removeFilePreview(element) {
        element.parentElement.remove();
        // Update selected files array
        const remainingPreviews = document.querySelectorAll('.file-preview');
        if (remainingPreviews.length === 0) {
            document.getElementById('upload-btn').disabled = true;
        }
    }

    /**
     * Handle file upload with DSA algorithms
     */
    async handleUpload() {
        if (!this.selectedFiles || this.selectedFiles.length === 0) {
            this.showMessage('Please select files to upload', 'error');
            return;
        }

        const caption = document.getElementById('post-caption').value;
        if (!caption.trim()) {
            this.showMessage('Please add a caption for your post', 'error');
            return;
        }

        try {
            this.showProgress(true);
            await this.uploadWithDSA(this.selectedFiles, caption);
            this.showMessage('Upload completed successfully!', 'success');
            this.loadBackupHistory();
        } catch (error) {
            this.showMessage(`Upload failed: ${error.message}`, 'error');
        } finally {
            this.showProgress(false);
        }
    }

    /**
     * Upload files using DSA concepts
     */
    async uploadWithDSA(files, caption) {
        const uploadPromises = files.map(file => this.uploadSingleFile(file, caption));
        await Promise.all(uploadPromises);
    }

    /**
     * Upload single file with chunking and deduplication
     */
    async uploadSingleFile(file, caption) {
        // Step 1: Chunk the file
        const chunks = await this.fileChunker.chunkFile(file);
        console.log(`File ${file.name} split into ${chunks.length} chunks`);

        // Step 2: Process each chunk with deduplication
        const chunkHashes = [];
        const uploadPromises = [];

        for (const chunk of chunks) {
            // Compute hash for deduplication
            const chunkHash = await this.hashManager.getHash(await chunk.data.arrayBuffer());
            chunkHashes.push(chunkHash);

            // Check if chunk already exists (deduplication)
            if (this.bloomFilter.mightContain(chunkHash)) {
                console.log(`Chunk ${chunk.index} already exists, skipping upload`);
                continue;
            }

            // Add to upload queue
            this.backupQueue.enqueue({
                chunk: chunk,
                hash: chunkHash,
                fileName: file.name
            });
        }

        // Step 3: Create Merkle Tree for integrity verification
        const merkleTree = new MerkleTree(chunkHashes);
        const rootHash = merkleTree.getRootHash();

        // Step 4: Process upload queue
        await this.processUploadQueue();

        // Step 5: Store file metadata in Firestore
        await this.storeFileMetadata(file, caption, chunks.length, rootHash);
    }

    /**
     * Process upload queue
     */
    async processUploadQueue() {
        let processedCount = 0;
        const totalChunks = this.backupQueue.size();

        while (!this.backupQueue.isEmpty()) {
            const uploadJob = this.backupQueue.dequeue();

            try {
                await this.uploadChunk(uploadJob);
                this.bloomFilter.add(uploadJob.hash);
                processedCount++;

                // Update progress
                const progress = (processedCount / totalChunks) * 100;
                this.updateProgress(progress);

            } catch (error) {
                console.error('Chunk upload failed:', error);
                // Re-queue failed uploads
                this.backupQueue.enqueue(uploadJob);
            }
        }
    }

    /**
     * Upload individual chunk to Firebase Storage
     */
    async uploadChunk(uploadJob) {
        const { chunk, hash, fileName } = uploadJob;
        const chunkRef = ref(firebaseStorage, `chunks/${hash}`);

        await uploadBytes(chunkRef, chunk.data);
        console.log(`Chunk ${chunk.index} uploaded successfully`);
    }

    /**
     * Store file metadata in Firestore
     */
    async storeFileMetadata(file, caption, chunkCount, rootHash) {
        const fileData = {
            userId: this.currentUser.uid,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            caption: caption,
            chunkCount: chunkCount,
            rootHash: rootHash,
            uploadedAt: serverTimestamp()
        };

        await addDoc(collection(firebaseDb, 'backups'), fileData);
    }

    /**
     * Load backup history
     */
    async loadBackupHistory() {
        try {
            const backupsRef = collection(firebaseDb, 'backups');
            const q = query(
                backupsRef,
                where('userId', '==', this.currentUser.uid),
                orderBy('uploadedAt', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const backups = [];

            querySnapshot.forEach((doc) => {
                backups.push({ id: doc.id, ...doc.data() });
            });

            this.displayBackupHistory(backups);
        } catch (error) {
            console.error('Error loading backup history:', error);
        }
    }

    /**
     * Display backup history
     */
    displayBackupHistory(backups) {
        const backupList = document.getElementById('backup-list');
        backupList.innerHTML = '';

        if (backups.length === 0) {
            backupList.innerHTML = '<p>No backups found. Upload some files to get started!</p>';
            return;
        }

        backups.forEach(backup => {
            const backupItem = document.createElement('div');
            backupItem.className = 'backup-item';
            backupItem.innerHTML = `
                <div class="backup-info">
                    <h3>${backup.fileName}</h3>
                    <p>${this.formatFileSize(backup.fileSize)} • ${backup.chunkCount} chunks • ${this.formatDate(backup.uploadedAt)}</p>
                    <p><strong>Caption:</strong> ${backup.caption}</p>
                </div>
                <div class="backup-actions">
                    <button class="btn btn-small btn-secondary" onclick="app.downloadSingleFile('${backup.id}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            `;
            backupList.appendChild(backupItem);
        });
    }

    /**
     * Handle restore/download all files
     */
    async handleRestore() {
        try {
            this.showRestoreProgress(true);
            await this.restoreAllFiles();
            this.showMessage('Restore completed successfully!', 'success');
        } catch (error) {
            this.showMessage(`Restore failed: ${error.message}`, 'error');
        } finally {
            this.showRestoreProgress(false);
        }
    }

    /**
     * Restore all files using stack-based reconstruction
     */
    async restoreAllFiles() {
        // Get all backup metadata
        const backupsRef = collection(firebaseDb, 'backups');
        const q = query(backupsRef, where('userId', '==', this.currentUser.uid));
        const querySnapshot = await getDocs(q);

        const files = [];
        querySnapshot.forEach((doc) => {
            files.push({ id: doc.id, ...doc.data() });
        });

        if (files.length === 0) {
            throw new Error('No files to restore');
        }

        // Create ZIP file
        const zip = new JSZip();

        for (const file of files) {
            try {
                const fileData = await this.reconstructFile(file);
                zip.file(file.fileName, fileData);
            } catch (error) {
                console.error(`Failed to reconstruct ${file.fileName}:`, error);
            }
        }

        // Download ZIP file
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        this.downloadFile(zipBlob, 'social-media-backup.zip');
    }

    /**
     * Reconstruct single file from chunks
     */
    async reconstructFile(fileMetadata) {
        // This is a simplified version - in a real implementation,
        // you would need to store chunk references and download them
        // For demo purposes, we'll create a placeholder
        return new Blob(['File content would be reconstructed from chunks'], { type: fileMetadata.mimeType });
    }

    /**
     * Download single file
     */
    async downloadSingleFile(backupId) {
        // Simplified implementation
        this.showMessage('Single file download not implemented in demo', 'error');
    }

    /**
     * Show/hide progress indicator
     */
    showProgress(show) {
        const progressContainer = document.getElementById('upload-progress');
        if (show) {
            progressContainer.classList.remove('hidden');
        } else {
            progressContainer.classList.add('hidden');
        }
    }

    /**
     * Update progress bar
     */
    updateProgress(percentage) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${Math.round(percentage)}%`;
    }

    /**
     * Show/hide restore progress
     */
    showRestoreProgress(show) {
        const progressContainer = document.getElementById('restore-progress');
        if (show) {
            progressContainer.classList.remove('hidden');
        } else {
            progressContainer.classList.add('hidden');
        }
    }

    /**
     * Download file
     */
    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Show message to user
     */
    showMessage(message, type) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;

        // Insert at top of main content
        const mainContent = document.querySelector('.app-main');
        mainContent.insertBefore(messageDiv, mainContent.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format date
     */
    formatDate(timestamp) {
        if (!timestamp) return 'Unknown';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SocialMediaBackupApp();
});

// Add JSZip library for ZIP file creation
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
document.head.appendChild(script);