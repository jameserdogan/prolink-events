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
    const ORGANIZATION_ID = '96393734683';
    
    // Make the API request to Eventbrite
    const eventbriteUrl = `https://www.eventbriteapi.com/v3/organizations/${ORGANIZATION_ID}/events/?status=live&order_by=start_asc&expand=venue,ticket_availability`;
    
    console.log('Fetching from Eventbrite:', eventbriteUrl);
    
    const response = await fetch(eventbriteUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Eventbrite API error:', response.status, response.statusText);
      throw new Error(`Eventbrite API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Filter to upcoming events only
    const now = new Date();
    const upcomingEvents = data.events.filter(event => {
      const eventDate = new Date(event.start.local);
      return eventDate > now;
    });

    console.log(`Found ${upcomingEvents.length} upcoming events`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        events: upcomingEvents,
        total_count: upcomingEvents.length,
        fetched_at: new Date().toISOString()
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
