document.addEventListener('DOMContentLoaded', () => {
    const introPanel = document.getElementById('intro-panel');
    
    // Fade out the intro panel after 2 seconds
    setTimeout(() => {
        introPanel.classList.add('fade-out');
        
        // Remove the intro panel from the DOM after the fade-out animation completes
        setTimeout(() => {
            introPanel.remove();
        }, 1000); // This should match the transition duration in CSS
    }, 1000);
});