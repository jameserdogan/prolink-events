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
      console.error('EVENTBRITE_TOKEN environment variable is not set!');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Configuration error',
          message: 'EVENTBRITE_TOKEN environment variable is not set. Please add it in Netlify settings.',
          debug: {
            env_vars: Object.keys(process.env).filter(key => !key.includes('SECRET') && !key.includes('TOKEN')),
            has_token: !!process.env.EVENTBRITE_TOKEN
          },
          events: []
        })
      };
    }

    console.log('API Key found, length:', API_KEY.length);

    // Fetch events using the correct endpoint
    const eventbriteUrl = `https://www.eventbriteapi.com/v3/organizations/90328674763/events/?order_by=start_asc&expand=venue,ticket_availability&page_size=100`;
    
    console.log('Fetching events from:', eventbriteUrl);
    
    const response = await fetch(eventbriteUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Eventbrite API error:', response.status);
      console.error('Error details:', errorText);
      
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: 'Eventbrite API error',
          message: `API returned ${response.status}: ${errorText}`,
          debug: {
            status: response.status,
            statusText: response.statusText,
            url: eventbriteUrl,
            token_length: API_KEY.length
          },
          events: []
        })
      };
    }

    const data = await response.json();
    
    // Log all events with their status
    console.log(`Total events from API: ${data.events.length}`);
    
    // Filter to upcoming events only (but include all statuses)
    const now = new Date();
    const upcomingEvents = data.events.filter(event => {
      const eventDate = new Date(event.start.local);
      const isUpcoming = eventDate > now;
      const isPublic = event.listed !== false;
      
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
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Function execution error',
        message: error.message,
        stack: error.stack,
        events: []
      })
    };
  }
};
