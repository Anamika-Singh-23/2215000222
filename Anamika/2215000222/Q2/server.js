const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 9876;


const API_BASE = 'http://20.244.56.144/evaluation-service';
const MAX_POSTS = 5;
const CACHE_TTL = 30000; 
const AUTH_CONFIG = {
  clientID: 'd9cbb699-6a27-44a5-8d59-8b1befa816da',
  clientSecret: 'tV3aaaRBSeXcRXeM',
  accessCode: 'CNneGT'
};


let authToken = null;
let tokenExpiry = 0;


let usersCache = new Map();
let postsCache = new Map();
let commentsCache = new Map();
let latestPosts = [];
let topCommentedPosts = [];


const getAuthToken = async () => {
  if (authToken && Date.now() < tokenExpiry) {
    return authToken;
  }

  try {
    const response = await axios.post(`${API_BASE}/auth`, {
      clientID: AUTH_CONFIG.clientID,
      clientSecret: AUTH_CONFIG.clientSecret,
      accessCode: AUTH_CONFIG.accessCode
    });

    authToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    console.log('Authentication successful');
    return authToken;
  } catch (error) {
    console.error('Authentication failed:', error.message);
    return null;
  }
};


const fetchWithAuth = async (url) => {
  const token = await getAuthToken();
  if (!token) return null;

  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 500
    });
    return response.data;
  } catch (error) {
    console.error(`API Error: ${url}`, error.message);
    return null;
  }
};

const fetchWithCache = async (url, cache) => {
  if (cache.has(url)) {
    const { data, timestamp } = cache.get(url);
    if (Date.now() - timestamp < CACHE_TTL) {
      return data;
    }
  }

  const data = await fetchWithAuth(url);
  if (data) {
    cache.set(url, {
      data: data,
      timestamp: Date.now()
    });
  }
  return data;
};

const updateLatestPosts = (newPosts) => {
  latestPosts = [...newPosts, ...latestPosts]
    .sort((a, b) => b.id - a.id)
    .slice(0, MAX_POSTS);
};

const updateTopCommentedPosts = async () => {
  const postCommentCounts = new Map();
  
  for (const [postId] of postsCache) {
    const comments = await fetchCommentsForPost(postId);
    postCommentCounts.set(postId, comments?.length || 0);
  }
  
  topCommentedPosts = [...postCommentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_POSTS)
    .map(([postId]) => postsCache.get(postId)?.data?.find(p => p.id == postId))
    .filter(Boolean);
};

const fetchCommentsForPost = async (postId) => {
  const url = `${API_BASE}/posts/${postId}/comments`;
  const data = await fetchWithCache(url, commentsCache);
  return data?.comments || [];
};


setInterval(async () => {
  try {
    
    const usersData = await fetchWithCache(`${API_BASE}/users`, usersCache);
    if (usersData?.users) {
      for (const [userId] of Object.entries(usersData.users)) {
        
        const postsData = await fetchWithCache(
          `${API_BASE}/users/${userId}/posts`, 
          postsCache
        );
        
        if (postsData?.posts) {
          updateLatestPosts(postsData.posts);
        }
      }
    }
    
    await updateTopCommentedPosts();
  } catch (error) {
    console.error('Background refresh error:', error.message);
  }
}, CACHE_TTL);


app.get('/feed/latest', async (req, res) => {
  res.json({
    posts: latestPosts,
    timestamp: Date.now()
  });
});

app.get('/feed/top-commented', async (req, res) => {
  res.json({
    posts: topCommentedPosts,
    timestamp: Date.now()
  });
});


app.listen(PORT, async () => {
  console.log(`Social Media Feed Service running on port ${PORT}`);
  
  
  try {
    await getAuthToken();
    const usersData = await fetchWithCache(`${API_BASE}/users`, usersCache);
    console.log('Initial data loaded successfully');
  } catch (error) {
    console.error('Initialization error:', error.message);
  }
});