const API_URL = import.meta.env.PROD
  ? 'https://focusmate-production.up.railway.app'
  : 'http://localhost:5000';

export default API_URL;