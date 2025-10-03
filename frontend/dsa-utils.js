/**
 * Data Structures & Algorithms Utilities for Social Media Backup System
 * Implements key DSA concepts: Hashing, Queues, Stacks, Trees, etc.
 */

// ==================== HASHING ALGORITHMS ====================

/**
 * SHA-256 Hash Implementation for File Deduplication
 * Uses Web Crypto API for secure hashing
 */
class HashManager {
    constructor() {
        this.hashCache = new Map(); // Cache for computed hashes
    }

    /**
     * Compute SHA-256 hash of a file chunk
     * @param {ArrayBuffer} data - File data to hash
     * @returns {Promise<string>} - Hex string of SHA-256 hash
     */
    async computeSHA256(data) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Get cached hash or compute new one
     * @param {ArrayBuffer} data - File data
     * @returns {Promise<string>} - Hash string
     */
    async getHash(data) {
        const dataKey = this.arrayBufferToString(data);
        if (this.hashCache.has(dataKey)) {
            return this.hashCache.get(dataKey);
        }

        const hash = await this.computeSHA256(data);
        this.hashCache.set(dataKey, hash);
        return hash;
    }

    /**
     * Convert ArrayBuffer to string for caching
     * @param {ArrayBuffer} buffer - ArrayBuffer to convert
     * @returns {string} - String representation
     */
    arrayBufferToString(buffer) {
        return Array.from(new Uint8Array(buffer)).join(',');
    }
}

// ==================== QUEUE DATA STRUCTURE ====================

/**
 * Queue implementation for managing backup jobs
 * Uses FIFO (First In, First Out) principle
 */
class Queue {
    constructor() {
        this.items = [];
        this.front = 0;
        this.rear = -1;
    }

    /**
     * Add item to the rear of queue
     * @param {any} item - Item to enqueue
     */
    enqueue(item) {
        this.rear++;
        this.items[this.rear] = item;
    }

    /**
     * Remove item from front of queue
     * @returns {any} - Front item or null if empty
     */
    dequeue() {
        if (this.isEmpty()) {
            return null;
        }
        const item = this.items[this.front];
        this.front++;
        return item;
    }

    /**
     * Check if queue is empty
     * @returns {boolean} - True if empty
     */
    isEmpty() {
        return this.front > this.rear;
    }

    /**
     * Get current queue size
     * @returns {number} - Number of items in queue
     */
    size() {
        return this.rear - this.front + 1;
    }

    /**
     * Peek at front item without removing
     * @returns {any} - Front item or null if empty
     */
    peek() {
        if (this.isEmpty()) {
            return null;
        }
        return this.items[this.front];
    }
}

// ==================== STACK DATA STRUCTURE ====================

/**
 * Stack implementation for file reconstruction during restore
 * Uses LIFO (Last In, First Out) principle
 */
class Stack {
    constructor() {
        this.items = [];
        this.top = -1;
    }

    /**
     * Push item onto stack
     * @param {any} item - Item to push
     */
    push(item) {
        this.top++;
        this.items[this.top] = item;
    }

    /**
     * Pop item from stack
     * @returns {any} - Top item or null if empty
     */
    pop() {
        if (this.isEmpty()) {
            return null;
        }
        const item = this.items[this.top];
        this.top--;
        return item;
    }

    /**
     * Check if stack is empty
     * @returns {boolean} - True if empty
     */
    isEmpty() {
        return this.top === -1;
    }

    /**
     * Get current stack size
     * @returns {number} - Number of items in stack
     */
    size() {
        return this.top + 1;
    }

    /**
     * Peek at top item without removing
     * @returns {any} - Top item or null if empty
     */
    peek() {
        if (this.isEmpty()) {
            return null;
        }
        return this.items[this.top];
    }
}

// ==================== MERKLE TREE ====================

/**
 * Merkle Tree implementation for file integrity verification
 * Each leaf node represents a file chunk hash
 * Internal nodes are hashes of their children
 */
class MerkleTree {
    constructor(hashes) {
        this.leaves = hashes;
        this.tree = [];
        this.rootHash = null;
        this.buildTree();
    }

    /**
     * Build the Merkle tree from leaf hashes
     */
    buildTree() {
        if (this.leaves.length === 0) {
            this.rootHash = '';
            return;
        }

        if (this.leaves.length === 1) {
            this.rootHash = this.leaves[0];
            return;
        }

        // Start with leaf hashes
        let currentLevel = [...this.leaves];
        this.tree = [currentLevel];

        // Build tree bottom-up
        while (currentLevel.length > 1) {
            const nextLevel = [];

            for (let i = 0; i < currentLevel.length; i += 2) {
                const left = currentLevel[i];
                const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
                const combined = left + right;
                const parentHash = this.simpleHash(combined);
                nextLevel.push(parentHash);
            }

            this.tree.push(nextLevel);
            currentLevel = nextLevel;
        }

        this.rootHash = currentLevel[0];
    }

    /**
     * Simple hash function for internal nodes
     * @param {string} input - String to hash
     * @returns {string} - Hash string
     */
    simpleHash(input) {
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * Get root hash of the tree
     * @returns {string} - Root hash
     */
    getRootHash() {
        return this.rootHash;
    }

    /**
     * Verify file integrity by comparing root hashes
     * @param {string} expectedRoot - Expected root hash
     * @returns {boolean} - True if integrity is verified
     */
    verifyIntegrity(expectedRoot) {
        return this.rootHash === expectedRoot;
    }
}

// ==================== FILE CHUNKING ALGORITHM ====================

/**
 * File Chunking Manager for splitting files into 512KB chunks
 * Implements efficient chunking with metadata tracking
 */
class FileChunker {
    constructor(chunkSize = 512 * 1024) { // 512KB default
        this.chunkSize = chunkSize;
    }

    /**
     * Split file into chunks
     * @param {File} file - File to chunk
     * @returns {Array<Object>} - Array of chunk objects with metadata
     */
    async chunkFile(file) {
        const chunks = [];
        const totalChunks = Math.ceil(file.size / this.chunkSize);

        for (let i = 0; i < totalChunks; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize, file.size);
            const chunkData = file.slice(start, end);

            chunks.push({
                index: i,
                data: chunkData,
                size: chunkData.size,
                totalChunks: totalChunks,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type
            });
        }

        return chunks;
    }

    /**
     * Reconstruct file from chunks
     * @param {Array<Object>} chunks - Array of chunk objects
     * @returns {Blob} - Reconstructed file as Blob
     */
    reconstructFile(chunks) {
        // Sort chunks by index
        const sortedChunks = chunks.sort((a, b) => a.index - b.index);

        // Create array of ArrayBuffers
        const buffers = sortedChunks.map(chunk => chunk.data);

        // Combine into single Blob
        return new Blob(buffers, { type: sortedChunks[0].mimeType });
    }
}

// ==================== BLOOM FILTER (OPTIONAL) ====================

/**
 * Bloom Filter for fast chunk existence checking
 * Reduces storage queries for non-existent chunks
 */
class BloomFilter {
    constructor(size = 10000, hashFunctions = 3) {
        this.size = size;
        this.hashFunctions = hashFunctions;
        this.bitArray = new Array(size).fill(false);
    }

    /**
     * Add item to bloom filter
     * @param {string} item - Item to add
     */
    add(item) {
        for (let i = 0; i < this.hashFunctions; i++) {
            const hash = this.hash(item, i);
            this.bitArray[hash] = true;
        }
    }

    /**
     * Check if item might exist in filter
     * @param {string} item - Item to check
     * @returns {boolean} - True if item might exist
     */
    mightContain(item) {
        for (let i = 0; i < this.hashFunctions; i++) {
            const hash = this.hash(item, i);
            if (!this.bitArray[hash]) {
                return false;
            }
        }
        return true;
    }

    /**
     * Hash function for bloom filter
     * @param {string} item - Item to hash
     * @param {number} seed - Hash seed
     * @returns {number} - Hash value
     */
    hash(item, seed) {
        let hash = seed;
        for (let i = 0; i < item.length; i++) {
            hash = ((hash << 5) - hash + item.charCodeAt(i)) & 0xffffffff;
        }
        return Math.abs(hash) % this.size;
    }
}

// ==================== LINKED LIST FOR CHUNK STORAGE ====================

/**
 * Linked List implementation for storing file chunks in order
 * Maintains chunk sequence for file reconstruction
 */
class ChunkNode {
    constructor(chunk, next = null) {
        this.chunk = chunk;
        this.next = next;
    }
}

class ChunkLinkedList {
    constructor() {
        this.head = null;
        this.tail = null;
        this.size = 0;
    }

    /**
     * Add chunk to the end of list
     * @param {Object} chunk - Chunk to add
     */
    append(chunk) {
        const newNode = new ChunkNode(chunk);

        if (!this.head) {
            this.head = newNode;
            this.tail = newNode;
        } else {
            this.tail.next = newNode;
            this.tail = newNode;
        }
        this.size++;
    }

    /**
     * Get chunk at specific index
     * @param {number} index - Index of chunk
     * @returns {Object|null} - Chunk at index or null
     */
    get(index) {
        let current = this.head;
        let currentIndex = 0;

        while (current && currentIndex < index) {
            current = current.next;
            currentIndex++;
        }

        return current ? current.chunk : null;
    }

    /**
     * Convert linked list to array
     * @returns {Array} - Array of chunks
     */
    toArray() {
        const chunks = [];
        let current = this.head;

        while (current) {
            chunks.push(current.chunk);
            current = current.next;
        }

        return chunks;
    }

    /**
     * Get list size
     * @returns {number} - Number of chunks
     */
    getSize() {
        return this.size;
    }
}

// ==================== EXPORT UTILITIES ====================

// Make utilities available globally
window.HashManager = HashManager;
window.Queue = Queue;
window.Stack = Stack;
window.MerkleTree = MerkleTree;
window.FileChunker = FileChunker;
window.BloomFilter = BloomFilter;
window.ChunkLinkedList = ChunkLinkedList;

console.log('DSA Utilities loaded successfully!');