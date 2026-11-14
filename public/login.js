const form = document.getElementById('loginForm');
const errorBox = document.getElementById('loginError');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.textContent = '';
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Signing in...';
  const formData = new FormData(form);
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: formData.get('username'), password: formData.get('password') })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to sign in.');
    window.location.href = '/';
  } catch (error) {
    errorBox.textContent = error.message;
    button.disabled = false;
    button.innerHTML = 'Sign in <span>→</span>';
  }
});
