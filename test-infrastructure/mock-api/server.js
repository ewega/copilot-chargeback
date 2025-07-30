const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// In-memory storage for cost centers and their users
const costCenters = {
  'engineering-cost-center': {
    name: 'engineering-cost-center',
    users: [
      { login: 'user2', id: 2 },
      { login: 'user3', id: 3 }
    ]
  },
  'org-wide-cost-center': {
    name: 'org-wide-cost-center',
    users: [
      { login: 'user1', id: 1 },
      { login: 'user4', id: 4 }
    ]
  },
  'design-cost-center': {
    name: 'design-cost-center',
    users: [
      { login: 'designer1', id: 101 },
      { login: 'designer2', id: 102 }
    ]
  }
};

// Response mode configuration for testing different scenarios
let responseMode = process.env.MOCK_RESPONSE_MODE || 'success';
let artificialDelay = parseInt(process.env.MOCK_DELAY_MS || '100');

// Helper function to simulate delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to handle different response modes
const handleResponseMode = (req, res, successCallback) => {
  setTimeout(async () => {
    switch (responseMode) {
      case 'error':
        return res.status(500).json({ error: 'Internal server error (simulated)' });
      case 'timeout':
        // Don't respond at all to simulate timeout
        return;
      case 'partial':
        if (Math.random() < 0.3) {
          return res.status(500).json({ error: 'Random partial failure' });
        }
        break;
    }
    
    try {
      await delay(artificialDelay);
      await successCallback();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }, 0);
};

// Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    mode: responseMode,
    delay: artificialDelay
  });
});

// Configuration endpoints for testing
app.post('/config/response-mode', (req, res) => {
  const { mode } = req.body;
  if (['success', 'error', 'timeout', 'partial'].includes(mode)) {
    responseMode = mode;
    res.json({ message: `Response mode set to: ${mode}` });
  } else {
    res.status(400).json({ error: 'Invalid response mode' });
  }
});

app.post('/config/delay', (req, res) => {
  const { delay } = req.body;
  if (typeof delay === 'number' && delay >= 0) {
    artificialDelay = delay;
    res.json({ message: `Artificial delay set to: ${delay}ms` });
  } else {
    res.status(400).json({ error: 'Invalid delay value' });
  }
});

// Cost center endpoints

// Get users in a cost center
app.get('/cost-centers/:name/users', (req, res) => {
  console.log(`GET /cost-centers/${req.params.name}/users`);
  
  handleResponseMode(req, res, async () => {
    const { name } = req.params;
    const costCenter = costCenters[name];
    
    if (!costCenter) {
      return res.status(404).json({ error: `Cost center '${name}' not found` });
    }
    
    res.json(costCenter.users);
  });
});

// Add user to a cost center
app.post('/cost-centers/:name/users', (req, res) => {
  console.log(`POST /cost-centers/${req.params.name}/users`, req.body);
  
  handleResponseMode(req, res, async () => {
    const { name } = req.params;
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Initialize cost center if it doesn't exist
    if (!costCenters[name]) {
      costCenters[name] = { name, users: [] };
    }
    
    const costCenter = costCenters[name];
    
    // Check if user already exists
    if (costCenter.users.find(user => user.login === username)) {
      return res.status(409).json({ error: `User '${username}' already exists in cost center '${name}'` });
    }
    
    // Add user
    const newUser = { 
      login: username, 
      id: Math.floor(Math.random() * 10000) + 1000 
    };
    costCenter.users.push(newUser);
    
    res.status(201).json({ 
      message: `User '${username}' added to cost center '${name}'`,
      user: newUser
    });
  });
});

// Remove user from a cost center
app.delete('/cost-centers/:name/users/:username', (req, res) => {
  console.log(`DELETE /cost-centers/${req.params.name}/users/${req.params.username}`);
  
  handleResponseMode(req, res, async () => {
    const { name, username } = req.params;
    const costCenter = costCenters[name];
    
    if (!costCenter) {
      return res.status(404).json({ error: `Cost center '${name}' not found` });
    }
    
    const userIndex = costCenter.users.findIndex(user => user.login === username);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: `User '${username}' not found in cost center '${name}'` });
    }
    
    const removedUser = costCenter.users.splice(userIndex, 1)[0];
    
    res.json({ 
      message: `User '${username}' removed from cost center '${name}'`,
      user: removedUser
    });
  });
});

// List all cost centers (for debugging)
app.get('/cost-centers', (req, res) => {
  console.log('GET /cost-centers');
  
  handleResponseMode(req, res, async () => {
    const centers = Object.keys(costCenters).map(name => ({
      name,
      userCount: costCenters[name].users.length
    }));
    
    res.json(centers);
  });
});

// Reset cost centers to initial state (for testing)
app.post('/reset', (req, res) => {
  console.log('POST /reset');
  
  // Reset to initial state
  Object.keys(costCenters).forEach(key => delete costCenters[key]);
  
  costCenters['engineering-cost-center'] = {
    name: 'engineering-cost-center',
    users: [
      { login: 'user2', id: 2 },
      { login: 'user3', id: 3 }
    ]
  };
  
  costCenters['org-wide-cost-center'] = {
    name: 'org-wide-cost-center',
    users: [
      { login: 'user1', id: 1 },
      { login: 'user4', id: 4 }
    ]
  };
  
  costCenters['design-cost-center'] = {
    name: 'design-cost-center',
    users: [
      { login: 'designer1', id: 101 },
      { login: 'designer2', id: 102 }
    ]
  };
  
  responseMode = 'success';
  artificialDelay = 100;
  
  res.json({ message: 'Cost centers reset to initial state' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Mock Cost Center API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Available cost centers:`, Object.keys(costCenters));
  console.log(`Response mode: ${responseMode}`);
  console.log(`Artificial delay: ${artificialDelay}ms`);
});