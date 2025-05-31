// netlify/functions/eventbrite-events.js
// This serverless function proxies requests to Eventbrite API to avoid CORS issues

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Your Eventbrite credentials (in production, use environment variables)
    const API_KEY = 'GMUXCJ75E66YDK52CI';
    
    // First, let's get the user's information to find the correct organization ID
    console.log('Getting user info first...');
    const userResponse = await fetch(`https://www.eventbriteapi.com/v3/users/me/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      console.error('User API error:', userResponse.status, userResponse.statusText);
      throw new Error(`User API error: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    console.log('User data received, ID:', userData.id);

    // Try using the user ID as organization ID (common pattern)
    const eventbriteUrl = `https://www.eventbriteapi.com/v3/users/me/owned_events/?status=live&order_by=start_asc&expand=venue,ticket_availability`;
    
    console.log('Fetching owned events:', eventbriteUrl);
    
    const response = await fetch(eventbriteUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Events API error:', response.status, response.statusText);
      
      // If owned_events doesn't work, try organizations endpoint
      const orgUrl = `https://www.eventbriteapi.com/v3/organizations/${userData.id}/events/?status=live&order_by=start_asc&expand=venue,ticket_availability`;
      console.log('Trying organization endpoint:', orgUrl);
      
      const orgResponse = await fetch(orgUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!orgResponse.ok) {
        console.error('Organization API error:', orgResponse.status, orgResponse.statusText);
        throw new Error(`All API endpoints failed: ${response.status}, ${orgResponse.status}`);
      }

      const orgData = await orgResponse.json();
      const now = new Date();
      const upcomingEvents = orgData.events.filter(event => {
        const eventDate = new Date(event.start.local);
        return eventDate > now;
      });

      console.log(`Found ${upcomingEvents.length} upcoming events via organization endpoint`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          events: upcomingEvents,
          total_count: upcomingEvents.length,
          fetched_at: new Date().toISOString(),
          method: 'organization'
        })
      };
    }

    const data = await response.json();
    
    // Filter to upcoming events only
    const now = new Date();
    const upcomingEvents = data.events.filter(event => {
      const eventDate = new Date(event.start.local);
      return eventDate > now;
    });

    console.log(`Found ${upcomingEvents.length} upcoming events via owned_events`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        events: upcomingEvents,
        total_count: upcomingEvents.length,
        fetched_at: new Date().toISOString(),
        method: 'owned_events'
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch events',
        message: error.message,
        events: [] // Return empty array so frontend can fall back to sample events
      })
    };
  }
};
