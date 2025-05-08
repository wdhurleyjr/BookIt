document.addEventListener('DOMContentLoaded', async function () {
  mapboxgl.accessToken = 'pk.eyJ1Ijoid2RodXJsZXlqciIsImEiOiJjbWEyMjh2MTIwZXA3MmpvbGtrZnBtZGlzIn0.HiCoA6sWpkoi1EDAkb1xeA';
  let addPinMode = false;
  let currentPinMarker = null;
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [-122.4194, 37.7749], // Default to San Francisco
    zoom: 13
  });

  await initializeMap();
  

   // Custom Pin Handlers
  document.getElementById('addPinBtn')?.addEventListener('click', () => {
    addPinMode = true;
    document.getElementById('pinControls').classList.remove('d-none');
  });

  document.getElementById('cancelPinBtn')?.addEventListener('click', () => {
    addPinMode = false;
    document.getElementById('pinControls').classList.add('d-none');
    if (currentPinMarker) currentPinMarker.remove();
  });

  document.getElementById('pinForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('pinTitle').value;
    const description = document.getElementById('pinDescription').value;
    
    if (currentPinMarker) {
      const lngLat = currentPinMarker.getLngLat();
      await saveCustomPin(lngLat.lat, lngLat.lng, title, description);
      document.getElementById('pinForm').reset();
      document.getElementById('pinControls').classList.add('d-none');
      currentPinMarker.remove();
      addPinMode = false;
    }
  });

    
   async function initializeMap() {
    // Geolocation Logic
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          await updateMapPosition(lat, lng);
        },
        async (error) => {
          console.warn('Geolocation failed:', error);
          await updateMapPosition(37.7749, -122.4194);
        },
        { timeout: 5000, enableHighAccuracy: true }
      );
    } else {
      await updateMapPosition(37.7749, -122.4194);
    }

    // Map Click Handler
    map.on('click', async (e) => {
      if (addPinMode) {
        if (currentPinMarker) currentPinMarker.remove();
        currentPinMarker = new mapboxgl.Marker({ color: '#FF0000' })
          .setLngLat([e.lngLat.lng, e.lngLat.lat])
          .addTo(map);
      } else {
        await updateMapPosition(e.lngLat.lat, e.lngLat.lng);
      }
    });

    // Event Delegation for Create Event Buttons
    document.body.addEventListener('click', (e) => {
      if (e.target.classList.contains('create-event-btn')) {
        const placeName = e.target.dataset.name;
        selectRestaurant(placeName);
      }
    });
  }
  async function updateMapPosition(lat, lng) {
    map.setCenter([lng, lat]);
    await Promise.all([
      loadRestaurants(lat, lng),
      loadCustomPins(lat, lng),
      updateWeather(lat, lng)
    ]);
  }

  // Custom Pin Functions
  async function saveCustomPin(lat, lng, title, description) {
    try {
      const response = await fetch('/api/savePin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, title, description })
      });
      if (response.ok) await loadCustomPins(lat, lng);
    } catch (error) {
      console.error('Error saving pin:', error);
    }
  }

  async function loadCustomPins() {
    try {
      const pins = await fetch('/api/getPins').then(res => res.json());
      pins.forEach(pin => createPinMarker(pin));
    } catch (error) {
      console.error('Error loading pins:', error);
    }
  }

  function createPinMarker(pin) {
    const el = document.createElement('div');
    el.className = 'custom-marker';
    el.innerHTML = '<i class="fa fa-map-pin fa-2x" style="color: #4CAF50;"></i>';

    new mapboxgl.Marker(el)
      .setLngLat([pin.lng, pin.lat])
      .setPopup(new mapboxgl.Popup().setHTML(`
        <h5>${pin.title}</h5>
        <p>${pin.description}</p>
        <button class="btn btn-primary btn-sm mt-2 create-event-btn" 
          data-name="${pin.title.replace(/"/g, '&quot;')}">
          Create Event Here
        </button>
      `))
      .addTo(map);
  }
  
  async function loadRestaurants(lat, lng) {
    try {
      console.log(`Fetching restaurants near [${lat}, ${lng}]...`);
      const response = await fetch(`/api/restaurants?lat=${lat}&lng=${lng}`);
      const data = await response.json();

      if (data.results && Array.isArray(data.results)) {
        console.log(`Found ${data.results.length} restaurants.`);

        data.results.forEach(place => {
          if (place.geometry && place.geometry.location) {
            const placeLat = place.geometry.location.lat;
            const placeLng = place.geometry.location.lng;
            const placeName = place.name;
            const googlePlaceId = place.place_id;
            const address = place.vicinity || 'Address unavailable';
            const photo = place.photos && place.photos.length > 0
              ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=AIzaSyDomEvMi4AHccGjMedgRCeJSFsBEZTaARM`
              : null;

            // Create a marker
            const marker = new mapboxgl.Marker()
              .setLngLat([placeLng, placeLat])
              .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
                <strong>${placeName}</strong><br>
                <button class="btn btn-primary btn-sm mt-2" onclick="selectRestaurant('${placeName}')">Create Event Here</button>
              `))
              .addTo(map);

            // Save place into database
            savePlaceToDatabase({ name: placeName, googlePlaceId, lat: placeLat, lng: placeLng, address, photo });
          }
        });
      } else {
        console.warn('⚠️ No restaurant results received.');
      }
    } catch (error) {
      console.error('❌ Error loading restaurants:', error);
    }
  }
  async function updateWeather(lat, lng) {
    try {
      const response = await fetch(`/api/weather?lat=${lat}&lng=${lng}`);
      const data = await response.json();
  
      const weatherSpan = document.getElementById('weatherInfo');
      if (weatherSpan && data && data.current && data.location) {
        const temp = data.current.temp_f;
        const condition = data.current.condition.text;
        const city = data.location.name;
        weatherSpan.textContent = `Weather:  ${temp}°F, ${condition} in ${city}`;
      }
    } catch (err) {
      console.error('❌ Error loading weather:', err);
    }
  }
  

  function savePlaceToDatabase(place) {
    fetch('/api/savePlace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(place)
    })
    .then(response => response.json())
    .then(data => {
      console.log('📦 Place saved:', data.message);
    })
    .catch(error => {
      console.error('❌ Error saving place:', error);
    });
  }
});

// Select a restaurant and show form
function selectRestaurant(name) {
  const restaurantInput = document.getElementById('restaurantName');
  const form = document.getElementById('createEventForm');

  if (restaurantInput && form) {
    restaurantInput.value = name;
    form.classList.remove('d-none');
    form.scrollIntoView({ behavior: 'smooth' });
  }
}
function populateModal(eventData) {
  console.log('Populating modal with event:', eventData);

  document.getElementById('eventId').value = eventData.eventId;
  document.getElementById('eventName').value = eventData.eventName;
  document.getElementById('restName').value = eventData.restName;

  const eventDateInput = document.getElementById('eventDate');
  const dateOnly = eventData.eventDate ? eventData.eventDate.split('T')[0] : '';
  eventDateInput.value = dateOnly;

  document.getElementById('eventTime').value = eventData.eventTime;
}
  
async function deleteEvent() {
  const eventId = document.getElementById('eventId').value;

  if (confirm('Are you sure you want to delete this event?')) {
    try {
        const response = await fetch(`/deleteEvent/${eventId}`, {
        method: 'DELETE'
        });

        const result = await response.json();
        console.log(result.message);

        // Refresh page after delete
        window.location.reload();
    } catch (error) {
        console.error('Error deleting event:', error);
    }
  }
}
