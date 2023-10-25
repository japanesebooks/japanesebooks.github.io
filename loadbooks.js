function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function loadContent(content) {
    $('#book').html(content);
    var a = document.getElementsByTagName("p");

    // Compute total char sum
    var chSum = 0;
    for(var ix = 0; ix < a.length; ix+= 1) {
        a[ix].id = "p"+ix;
        chSum += a[ix].innerText.length;
    }

    // Add PF elements every 15 paras
    for(var ix = 0; ix < a.length; ix+= 15) {
        p = document.createElement('p');
        idd = Math.floor(ix / 15)
        p.id = "pf" + idd;
        t = document.createTextNode("pf"+idd);
        p.appendChild(t);
        a[ix].parentNode.insertBefore(p, a[ix]);
    }

    // Add charsum elem
    chsumP = document.createElement('p');
    chsumP.id = 'chsum';
    t = document.createTextNode("char total: " + chSum);
    chsumP.appendChild(t);
    a[a.length - 1].parentNode.appendChild(chsumP);

    // Upon clicking an element, save as last clicked for this book
    $('p').on('click', function () {
        window.current_line = this.id;
    });
}
function setBook(i) {
    $('#realbook').load('/b' + i + '.html', function(rsp, stat, xhr) {
        var a = document.getElementsByTagName("p");

        // Compute total char sum
        var chSum = 0;
        for(var ix = 0; ix < a.length; ix+= 1) {
            a[ix].id = "p"+ix;
            chSum += a[ix].innerText.length;
        }

        // Add PF elements every 15 paras
        for(var ix = 0; ix < a.length; ix+= 15) {
            p = document.createElement('p');
            idd = Math.floor(ix / 15)
            p.id = "pf" + idd;
            t = document.createTextNode("pf"+idd);
            p.appendChild(t);
            a[ix].parentNode.insertBefore(p, a[ix]);
        }

        // Add charsum elem
        chsumP = document.createElement('p');
        chsumP.id = 'chsum';
        t = document.createTextNode("char total: " + chSum);
        chsumP.appendChild(t);
        a[a.length - 1].parentNode.appendChild(chsumP);

        // Upon clicking an element, save as last clicked for this book
        $('p').on('click', function () {
            document.cookie = "jumpto" + i + "=" + this.id + ";expires=Fri, 31 Dec 9999 23:59:59 GMT";
        });

        // Load last clicked and jump to it
        var e1 = getCookie("jumpto" + i);
        window.location.href = "#" + e1;
        try {
            document.getElementById(e1).style.backgroundColor="#FDFF47";
        } catch(e) {}
    }); 
}

function goToLine(line) {
    window.location.href = "#" + line;
    try {
        document.getElementById(line).style.backgroundColor="#FDFF47";
    } catch(e) {}
}

// function onBooksLoaded() {
//     $('#testbook').remove();
//     if(window.nBooks == 0) {
//         alert("Error: No books were loaded.");
//     }

//     window.currentBook = getCookie("lastbook");
//     if(window.currentBook === undefined || window.currentBook >= window.nBooks) {
//         window.currentBook = 0;
//     }

//     for(var i = 0; i < window.nBooks; i++) {
//         $('#bookselect').append($(document.createElement('option')).prop({
//             value: i,
//             text: 'B ' + i
//         }));
//     }
//     $('#bookselect').val(window.currentBook);
//     $('#bookselect').change(function() {
//         var sel = $("option:selected", this)[0];
//         document.cookie = "lastbook=" + sel.value + ";expires=Fri, 31 Dec 9999 23:59:59 GMT";
//         setBook(sel.value);
//     });

//     setBook(window.currentBook);       
// } 
function loadAllBooks() {
    $('#testbook').load('/b' + window.nBooks + '.html', function(responseTxt, statusTxt, xhr){
        if(statusTxt == "success") {
            window.nBooks += 1;
            loadAllBooks();
        } else {
            onBooksLoaded();
        }
    });
}

window.books = [];

const APP_ID = 'application-0-sreyk';
const ATLAS_SERVICE = 'mongodb-atlas';
const app = new Realm.App({id: APP_ID});

// Function executed by the LOGIN button.
const login = async () => {
    const credentials = Realm.Credentials.anonymous();
    try {
        const user = await app.logIn(credentials);
        $('#user').empty().append("User ID: " + user.id); // update the user div with the user ID
    } catch (err) {
        console.error("Failed to log in", err);
    }
};

const get_colls = () => {
    try {
        // Access the books collection through MDB Realm & the readonly rule.
        const mongodb = app.currentUser.mongoClient(ATLAS_SERVICE);
        window.collMetadata = mongodb.db("books").collection("metadata");
        window.collContent = mongodb.db("books").collection("content");
        window.collVocab = mongodb.db("books").collection("vocab");
    } catch (err) {
        $("#user").append("Need to login first.");
        console.error("Need to log in first", err);
        return;
    }
}

// Function executed by the "FIND 20 books" button.
const get_books = async () => {
    console.log("finding books...");
    const collContent = window.collContent;
    if(collContent === undefined) {
        console.error("Null coll");
        return;
    }
    const books = await collContent.find({}, {
        "projection": {
            "_id": 1,
            "title": 1
        },
    });

    const dict = books.reduce(function(map, obj) {
        map[obj._id] = {"title": obj.title};
        return map;
    }, {});

    return dict;
};

const add_book = async (title, content) => {
    const collContent = window.collContent;
    if(collContent === undefined) {
        console.error("Null coll");
        return;
    }

    let docToInsert = {
        "title": title, "content": content
    };
    const id = (await collContent.insertOne(docToInsert)).insertedId;
    const ts = get_timestamp();
    console.log("Created with ID: " + id);
    window.localBookInfo[id] = docToInsert;
    push_current_timestamp();
    localStorage.setItem("bookList", JSON.stringify(window.localBookInfo));
    localStorage.setItem("bookListLastUpdated", window.metadata.last_updated);
}

const delete_book = async (id, cb) => {
    const collContent = window.collContent;
    if(collContent === undefined) {
        console.error("Null coll");
        return;
    }

    await collContent.deleteOne({"_id": new Realm.BSON.ObjectId(id)});
    try {
        delete window.metadata.currentLines[id];
        await window.collMetadata.updateOne({}, {"$set": {"currentLines": window.metadata.currentLines}});
    } catch (err) {}
    delete window.localBookInfo[id];
    push_current_timestamp();
    localStorage.setItem("bookList", JSON.stringify(window.localBookInfo));
    localStorage.setItem("bookListLastUpdated", window.metadata.last_updated);
    cb();
}

const get_timestamp = function() {
    const currentDate = new Date(); 
    return currentDate.getTime().toString();
}

const push_current_timestamp = async () => {
    const ts = get_timestamp();
    window.metadata.lastUpdated = ts;
    await window.collMetadata.updateOne({}, {"$set": {"lastUpdated": ts}});
}

const fetch_metadata = async () => {
    const collMeta = window.collMetadata;
    if(collMeta === undefined) {
        console.error("Null coll");
        return;
    }
    let mdList = await collMeta.find({});
    if(mdList.length === 0) {
        const ts = get_timestamp();
        const metadata = {
            "schemaVersion": 0,
            "lastUpdated": ts
        };
        await collMeta.insertOne(metadata);
        window.metadata = metadata;
        return metadata;
    }
    window.metadata = mdList[0];
}

const sync_current_line_to_db = async () => {
    const collMeta = window.collMetadata;
    if(collMeta === undefined) {
        console.error("Null coll");
        return;
    }
    if(!("currentLines" in window.metadata)) {
        window.metadata.currentLines = {};
    }
    window.metadata.currentLines[window.current_book] = window.current_line;
    await collMeta.updateOne({}, {"$set": {"currentLines": window.metadata.currentLines}});
}

const load_current_book = async() => {
    if(!("content" in window.localBookInfo[window.current_book])) {
        const collContent = window.collContent;
        if(collContent === undefined) {
            console.error("Null coll");
            return;
        }
        const matches = await collContent.find({"_id": new Realm.BSON.ObjectId(window.current_book)});
        if(matches.length === 0) {
            console.error("no currbook matched")
            return;
        }
        window.localBookInfo[window.current_book].content = matches[0].content
    }

    loadContent(window.localBookInfo[window.current_book].content);
}

const goto_book = async(book_id) => {
    // sync line of current
    if(window.current_book !== undefined && window.current_line !== undefined && window.current_line !== window.metadata.currentLines[window.current_book]) {
        await sync_current_line_to_db();
    }
    window.current_book = book_id;
    window.current_line = window.metadata.currentLines[book_id];
    await load_current_book();
    goToLine(window.current_line);
    window.metadata.currentBook = book_id;
    const collMeta = window.collMetadata;
    if(collMeta === undefined) {
        console.error("Null coll");
        return;
    }
    await collMeta.updateOne({}, {"$set": {"currentBook": window.metadata.currentBook}});
}

const add_vocab_to_save_list = async(toAdd, sentence) => {
    const collVocab = window.collVocab;
    if(collVocab === undefined) {
        console.error("Null coll");
        return;
    }
    console.log("Inserting: " + toAdd + ": " + sentence);
    await collVocab.insertOne({"vocab": toAdd, "sentence": sentence});
}

const fetch_vocab = async() => {
    const collVocab = window.collVocab;
    if(collVocab === undefined) {
        console.error("Null coll");
        return;
    }
    window.vocab = await collVocab.find({});
}

const delete_vocab = async (id, cb) => {
    const collVocab = window.collVocab;
    if(collVocab === undefined) {
        console.error("Null coll");
        return;
    }
    const rid = new Realm.BSON.ObjectId(id);
    await collVocab.deleteOne({_id: rid});
    window.vocab = window.vocab.filter(el => !el._id.equals(rid));
    cb();
}

const delete_all_vocab = async (cb) => {
    const collVocab = window.collVocab;
    if(collVocab === undefined) {
        console.error("Null coll");
        return;
    }
    await collVocab.deleteMany({});
    window.vocab = [];
    cb();
}