const http = require('http');
const axios = require('axios');

class AuthService {
  constructor() {
    this.config = {
      baseUrl: 'http://20.244.56.144/evaluation-service',
      registration: {
        email: 'anamika.singh_Cs22@gla.ac.in',
        name: 'Anamika Singh',
        mobileNo: '8090729030',
        githubUsername: 'Anamika-Singh-23',
        rollNo: '2215000222',
        collegeName: 'GLA University',
        accessCode: 'CNneGT' 
      },
      auth: {
        clientID: '',
        clientSecret: '',
        token: '',
        tokenExpiry: 0
      }
    };
  } 

  async registerCompany() {
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/register`,
        this.config.registration
      );
      
      this.config.auth.clientID = response.data.clientID;
      this.config.auth.clientSecret = response.data.clientSecret;
      
      console.log('Registration successful. Credentials saved.');
      return true;
    } catch (error) {
      console.error('Registration failed:', error.message);
      return false;
    }
  }

  async getAuthToken() {

    if (this.config.auth.token && Date.now() < this.config.auth.tokenExpiry) {
      return this.config.auth.token;
    }

    try {
      const response = await axios.post(`${this.config.baseUrl}/auth`, {
        email: this.config.registration.email,
        name: this.config.registration.name,
        rollNo: this.config.registration.rollNo,
        accessCode: this.config.registration.accessCode,
        clientID: this.config.auth.clientID,
        clientSecret: this.config.auth.clientSecret
      });

      this.config.auth.token = response.data.access_token;
      this.config.auth.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      console.log('New auth token obtained');
      return this.config.auth.token;
    } catch (error) {
      console.error('Authentication failed:', error.message);
      return null;
    }
  }
}

class NumberService {
  constructor(authService) {
    this.authService = authService;
    this.windowSize = 10;
    this.numberWindows = new Map();
    this.endpoints = {
      p: 'primes',
      f: 'fibo',
      e: 'even',
      r: 'rand'
    };
  }

  async fetchNumbers(type) {
    const token = await this.authService.getAuthToken();
    if (!token) return [];

    try {
      const response = await axios.get(
        `${this.authService.config.baseUrl}/${this.endpoints[type]}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          timeout: 500
        }
      );
      return response.data.numbers || [];
    } catch (error) {
      console.error(`Failed to fetch ${type} numbers:`, error.message);
      return [];
    }
  }

  
}


(async () => {
  const authService = new AuthService();
  
  await authService.registerCompany();

  
  const numberService = new NumberService(authService);
  const port = 9876;

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url.startsWith('/numbers/')) {
        const type = req.url.split('/')[2].toLowerCase();
        
        if (!numberService.endpoints[type]) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Invalid number type' }));
        }

        const result = await numberService.processRequest(type);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error.message }));
    }
  });

  server.listen(port, () => {
    console.log(`Number service running on port ${port}`);
  });
})();