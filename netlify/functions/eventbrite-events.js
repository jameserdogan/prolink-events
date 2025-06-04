// netlify/functions/eventbrite-events.js

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    // Get API key from environment variable
    const API_KEY = process.env.EVENTBRITE_TOKEN;
    
    if (!API_KEY) {
      throw new Error('EVENTBRITE_TOKEN not configured');
    }

    // Fetch events using the correct endpoint - get ALL events including drafts and scheduled
    const eventbriteUrl = `https://www.eventbriteapi.com/v3/organizations/90328674763/events/?order_by=start_asc&expand=venue,ticket_availability&page_size=100`;
    
    console.log('Fetching ALL events (including drafts)...');
    
    const response = await fetch(eventbriteUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Eventbrite API error:', response.status);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      throw new Error(`Eventbrite API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Log all events with their status
    console.log(`Total events from API: ${data.events.length}`);
    data.events.forEach(event => {
      console.log(`- ${event.name.text} | Status: ${event.status} | Date: ${event.start.local}`);
    });
    
    // Filter to upcoming events only (but include all statuses)
    const now = new Date();
    const upcomingEvents = data.events.filter(event => {
      const eventDate = new Date(event.start.local);
      const isUpcoming = eventDate > now;
      const isPublic = event.listed !== false; // Include if listed is true or undefined
      
      if (!isUpcoming) {
        console.log(`Filtered out past event: ${event.name.text}`);
      }
      if (!isPublic) {
        console.log(`Filtered out private event: ${event.name.text}`);
      }
      
      return isUpcoming && isPublic;
    });

    console.log(`Returning ${upcomingEvents.length} upcoming public events`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        events: upcomingEvents,
        total_count: upcomingEvents.length,
        total_events_found: data.events.length,
        debug: {
          all_statuses: [...new Set(data.events.map(e => e.status))],
          upcoming_by_status: {
            live: upcomingEvents.filter(e => e.status === 'live').length,
            draft: upcomingEvents.filter(e => e.status === 'draft').length,
            started: upcomingEvents.filter(e => e.status === 'started').length,
            ended: upcomingEvents.filter(e => e.status === 'ended').length,
            completed: upcomingEvents.filter(e => e.status === 'completed').length
          }
        },
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
        events: []
      })
    };
  }
};
