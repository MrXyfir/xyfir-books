import request from "../request/";

function loadFromApi(book, library) {
    if (navigator.onLine) {
        let xhr = new XMLHttpRequest();
        
        xhr.responseType = "blob";
        
        // Receive file blob from server
        xhr.onload = function() {
            let reader = new FileReader();
            
            // Set image.src and save image to local storage
            reader.onloadend = () => {
                document.getElementById(`cover-${book.id}`).src = reader.result;
                
                localforage.setItem(`cover-${book.id}-${book.versions.cover}`, reader.result);
            }
            
            // Convert blob to base64 data url
            reader.readAsDataURL(xhr.response);
        };

        // Build url using state.account.library.address|id / book.cover path
        const url = library.address + "library/" + library.id + "/files/"
            + book.cover.split('/').slice(-3).join('/');

        xhr.open("GET", url);
        xhr.send();
    }
}

export default function(books, library) {
    
    [].forEach.call(document.querySelectorAll("img.cover"), img => {
        if (!img.src) {
            const id = img.id.split('-')[1];
            const book = books.find(b => id == b.id);
            
            // Determine if we have book's latest cover stored
            localforage.getItem(`cover-${id}-${book.versions.cover}`).then(cover => {
                if (cover == null) {
                    loadFromApi(book, library);
                }
                else {
                    document.getElementById(img.id).src = cover;
                }
            }).catch(err => loadFromApi(book, library));
        }
    });
    
}