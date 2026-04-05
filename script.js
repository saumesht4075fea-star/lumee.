document.getElementById('year').textContent = new Date().getFullYear();

// PocketBase Configuration
// IMPORTANT: Change 'http://127.0.0.1:8090' to your Render public URL!
const PB_URL = 'https://lumee-pocketbase-backend.onrender.com'; 
const COLLECTION_NAME = 'posts'; // Ensure this matches your PocketBase collection name for ebooks
const pb = new PocketBase(PB_URL);

let loadedEbooks = []; // This array will now hold data fetched from PocketBase
let currentActiveSection = 'home'; // Track the currently active section

// Function to save and restore active section
function saveActiveSection(sectionId) {
    localStorage.setItem('activeSection', sectionId);
    currentActiveSection = sectionId;
}

function restoreActiveSection() {
    const savedSection = localStorage.getItem('activeSection');
    if (savedSection && document.getElementById(savedSection)) {
        showSection(savedSection);
    } else {
        showSection('home');
    }
}

// Function to generate a product card HTML
function createProductCard(bookRecord) {
    // Access fields using record.fieldName (PocketBase usually lowercases them, but your example uses capitalized ones)
    const id = bookRecord.id;
    const title = bookRecord.Title || bookRecord.title || 'No Title';
    const author = bookRecord.Author || bookRecord.author || 'Unknown Author';
    const price = bookRecord.Price || bookRecord.price; // Will be number
    const coverimage = bookRecord.coverimage; // Will be filename

    let imageUrl = '';
    if (coverimage) {
        // Construct URL for cover image: [PB_URL]/api/files/[collection_name]/[record_id]/[filename]
        imageUrl = `${PB_URL}/api/files/${COLLECTION_NAME}/${id}/${coverimage}`;
    } else {
        // Placeholder image if no cover is found
        imageUrl = 'https://via.placeholder.com/280x280?text=No+Cover';
    }

    return `
        <article class="card" onclick="showEbookDetail('${id}')">
            <img src="${imageUrl}" alt="${title} cover">
            <div class="card-body">
                <h3>${title}</h3>
                <div class="author">by ${author}</div>
                <div class="price">₹${price ? price.toFixed(2) : 'N/A'}</div>
            </div>
        </article>`;
}

// Function to load products into a given list element
function loadProducts(elementId, booksToLoad) {
    const productList = document.getElementById(elementId);
    if (productList) {
        productList.innerHTML = booksToLoad.map(record => createProductCard(record)).join('');
        if (booksToLoad.length === 0) {
            productList.innerHTML = '<p style="text-align:center;color:var(--muted);">No ebooks found.</p>';
        }
    }
}

// Show specific section and hide others, plus save state
const originalShowSection = function(sectionId) {
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        saveActiveSection(sectionId); // Save the active section
    }

    // close all modals when switching sections
    closeModal('signin-modal');
    closeModal('register-modal');

    // Re-load ebooks if navigating to relevant sections
    if (sectionId === 'books' || sectionId === 'home') {
        // Since data is now fetched, ensure it's loaded and filtered
        if (loadedEbooks.length === 0) { // Only fetch if not already loaded
            fetchAndDisplayPosts();
        } else { // Otherwise just re-render with existing data
            renderEbooks();
        }
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = ''; // Clear search on section switch
            filterBooks(); // Apply filter after loading (clearing search essentially shows all)
        }
    }
};

// Global showSection variable, allowing it to be overridden for back button logic
window.showSection = function(sectionId) {
    if (currentActiveSection !== sectionId) { // Only update if actually changing sections
        window.previousSectionId = currentActiveSection; // Use window to make it truly global
    }
    originalShowSection(sectionId);
};

// Function to navigate to ebook detail page
function showEbookDetail(ebookId) {
    const ebook = loadedEbooks.find(b => b.id === ebookId);
    if (!ebook) {
        console.error("Ebook not found:", ebookId);
        showSection('books'); // Fallback to books section
        return;
    }

    // Access fields using record.fieldName (PocketBase usually lowercases them)
    const title = ebook.Title || ebook.title || 'No Title';
    const author = ebook.Author || ebook.author || 'Unknown Author';
    const price = ebook.Price || ebook.price;
    const coverimage = ebook.coverimage;
    const downloadurl = ebook.downloadurl;
    const description = ebook.description;

    let imageUrl = '';
    if (coverimage) {
        imageUrl = `${PB_URL}/api/files/${COLLECTION_NAME}/${ebook.id}/${coverimage}`;
    } else {
        imageUrl = 'https://via.placeholder.com/280x280?text=No+Cover';
    }

    document.getElementById('ebook-detail-cover-img').src = imageUrl;
    document.getElementById('ebook-detail-cover-img').alt = `${title} cover`;
    document.getElementById('ebook-detail-title').textContent = title;
    document.getElementById('ebook-detail-author').textContent = `by ${author}`;
    document.getElementById('ebook-detail-price').textContent = `₹${price ? price.toFixed(2) : 'N/A'}`;
    document.getElementById('ebook-detail-description').textContent = description || 'No description available.';

    const buyButton = document.getElementById('ebook-detail-buy-btn');
    if (downloadurl) {
        buyButton.href = downloadurl;
        buyButton.style.display = 'inline-block';
    } else {
        buyButton.removeAttribute('href');
        buyButton.style.display = 'none';
    }

    // Load related books
    loadAuthorBooks(author, ebookId);
    loadSimilarBooks(ebookId);

    showSection('ebook-detail');
}

// Go back functionality
window.previousSectionId = 'home'; // Default previous section

function goBackToPreviousSection() {
    showSection(window.previousSectionId);
}

// Close Modal
function closeModal(modalId, event = null){
    const modalElement = document.getElementById(modalId);
    if (!modalElement) return;

    if (event) {
        const clickedElement = event.target;
        // Check if clicked element is the modal overlay itself or a close button
        if (clickedElement === modalElement || clickedElement.closest('.close-btn')) {
            modalElement.classList.remove('active');
        }
    } else {
        modalElement.classList.remove('active');
    }
}

// Function to filter books based on search input
function filterBooks() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filteredEbooks = loadedEbooks.filter(ebook =>
        (ebook.Title || ebook.title || '').toLowerCase().includes(searchTerm) ||
        (ebook.Author || ebook.author || '').toLowerCase().includes(searchTerm)
    );
    loadProducts('all-books-list', filteredEbooks);
}

// Load books by the same author
function loadAuthorBooks(author, currentEbookId) {
    const authorBooks = loadedEbooks.filter(ebook =>
        (ebook.Author || ebook.author) === author && ebook.id !== currentEbookId
    );
    // Hide loading/error for this section before loading
    document.getElementById('author-books-loading').style.display = 'none';
    document.getElementById('author-books-error').style.display = 'none';
    loadProducts('author-books-list', authorBooks);
}

// Load similar books (from fetched data)
function loadSimilarBooks(currentEbookId) {
    // Get a few random books that are not the current one or by the same author
    const similarBooks = loadedEbooks.filter(ebook => ebook.id !== currentEbookId)
        .sort(() => 0.5 - Math.random()) // Randomize order
        .slice(0, 3); // Take top 3
    // Hide loading/error for this section before loading
    document.getElementById('similar-books-loading').style.display = 'none';
    document.getElementById('similar-books-error').style.display = 'none';
    loadProducts('similar-books-list', similarBooks);
}

// Function to render ebooks to both home and all-books sections
function renderEbooks() {
    // Sort by 'created' field, newest first
    loadedEbooks.sort((a, b) => new Date(b.created) - new Date(a.created));

    // Hide loading messages
    document.getElementById('homepage-loading').style.display = 'none';
    document.getElementById('allbooks-loading').style.display = 'none';
    document.getElementById('homepage-error').style.display = 'none';
    document.getElementById('allbooks-error').style.display = 'none';

    if (loadedEbooks.length === 0) {
        document.getElementById('homepage-ebook-list').innerHTML = '<p class="loading-message">No featured ebooks available yet.</p>';
        document.getElementById('all-books-list').innerHTML = '<p class="loading-message">No ebooks available yet.</p>';
    } else {
        loadProducts('homepage-ebook-list', loadedEbooks.slice(0, 3)); // Show 3 featured
        loadProducts('all-books-list', loadedEbooks); // Show all books
    }
}

// Function to fetch data from PocketBase
async function fetchAndDisplayPosts() {
    try {
        // Show loading messages
        document.getElementById('homepage-loading').style.display = 'block';
        document.getElementById('allbooks-loading').style.display = 'block';
        document.getElementById('homepage-error').style.display = 'none';
        document.getElementById('allbooks-error').style.display = 'none';

        // Fetch records from the 'posts' collection
        const records = await pb.collection(COLLECTION_NAME).getFullList({
            sort: '-created', // Sort by creation date, newest first
        });

        loadedEbooks = records; // Store fetched records globally

        renderEbooks(); // Render the fetched ebooks
    } catch (error) {
        console.error('Error fetching posts:', error);
        // Show error messages and hide loading
        document.getElementById('homepage-loading').style.display = 'none';
        document.getElementById('allbooks-loading').style.display = 'none';
        document.getElementById('homepage-error').style.display = 'block';
        document.getElementById('allbooks-error').style.display = 'block';

        document.getElementById('homepage-ebook-list').innerHTML = ''; // Clear content
        document.getElementById('all-books-list').innerHTML = ''; // Clear content
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchAndDisplayPosts(); // Fetch ebooks from PocketBase
    restoreActiveSection(); // Restore previous section

    // Dummy auth controls
    const authControls = document.getElementById('authControls');
    authControls.innerHTML = `
        <button onclick="openSignInModal()">Sign In</button>
        <button onclick="openRegisterModal()">Register</button>
    `;
});

// Dummy function for modals (no real auth logic)
function openSignInModal() {
    document.getElementById('signin-modal').classList.add('active');
    const signInError = document.querySelector('#signin-modal .error-message');
    if (signInError) signInError.style.display = 'block'; // Show error message by default
}

function openRegisterModal() {
    document.getElementById('register-modal').classList.add('active');
    const registerError = document.querySelector('#register-modal .error-message');
    if (registerError) registerError.style.display = 'block'; // Show error message by default
}