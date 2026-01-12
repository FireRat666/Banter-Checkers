(function() {
    // This script is a redirect to the new checkers.js file.
    // It preserves the query parameters from the original script tag.

    const currentScript = document.currentScript;
    if (!currentScript) {
        console.error("Banter Checkers: Could not find current script tag to redirect.");
        return;
    }

    const currentSrc = currentScript.src;
    const searchParams = currentSrc.split('?')[1] || '';

    // The new script is one level up from the 'js' directory.
    const newScriptUrl = new URL('../checkers.js', currentSrc).href;
    
    const finalUrl = newScriptUrl + (searchParams ? '?' + searchParams : '');

    const script = document.createElement('script');
    script.src = finalUrl;
    document.body.appendChild(script);

    console.log(`Banter Checkers: Loading from new location: ${finalUrl}`);
})();