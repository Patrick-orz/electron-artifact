const textarea = document.getElementById('ta');
textarea.value = await store.load("text");
textarea.addEventListener('input', function() {
  store.save("text", textarea.value);
}, false);
