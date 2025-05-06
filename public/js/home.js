document.addEventListener('DOMContentLoaded', async function () {
  // Shared variables
  let map;
  let addPinMode = false;
  let currentMarker = null;
  
  // Initialize map with both restaurants and custom pins
  async function initializeMap() {
      mapboxgl.accessToken = 'pk.eyJ1Ijoid2RodXJsZXlqciIsImEiOiJjbWEyMjh2MTIwZXA3MmpvbGtrZnBtZGlzIn0.HiCoA6sWpkoi1EDAkb1xeA';
      map = new mapboxgl.Map({
          container: 'map',
          style: 'mapbox://styles/mapbox/streets-v11',
          center: [-122.4194, 37.7749],
          zoom: 13
      });

      // Load initial data
      await loadCustomPins();
      setupPinControls();

      // Existing geolocation logic
      console.log('Checking for geolocation...');
      if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
              async function (position) {
                  const lat = position.coords.latitude;
                  const lng = position.coords.longitude;
                  map.setCenter([lng, lat]);
                  await loadRestaurants(lat, lng);
              },
              async function (error) {
                  console.warn('⚠️ Geolocation failed:', error);
                  map.setCenter([-122.4194, 37.7749]);
                  await loadRestaurants(37.7749, -122.4194);
              },
              { timeout: 5000, enableHighAccuracy: true }
          );
      } else {
          console.warn('⚠️ Geolocation not supported');
          loadRestaurants(37.7749, -122.4194);
      }
  }

  // Custom Pin Functionality
  async function loadCustomPins() {
      try {
          const pins = await fetch('/api/getPins').then(res => res.json());
          pins.forEach(pin => {
              const el = document.createElement('div');
              el.className = 'custom-marker';
              el.innerHTML = '<i class="fa fa-map-pin fa-2x" style="color:rgb(201, 34, 34);"></i>';

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
          });
      } catch (error) {
          console.error('Error loading custom pins:', error);
      }
  }

  function setupPinControls() {
      // Pin Controls Event Listeners
      document.getElementById('addPinBtn').addEventListener('click', () => {
          addPinMode = true;
          document.getElementById('addPinBtn').disabled = true;
      });

      document.getElementById('cancelPinBtn').addEventListener('click', () => {
          addPinMode = false;
          document.getElementById('addPinBtn').disabled = false;
          document.getElementById('pinControls').classList.add('d-none');
          if (currentMarker) currentMarker.remove();
      });

      document.getElementById('pinForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const title = document.getElementById('pinTitle').value;
          const description = document.getElementById('pinDescription').value;
          const lngLat = currentMarker.getLngLat();

          try {
              const response = await fetch('/api/savePin', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ lat: lngLat.lat, lng: lngLat.lng, title, description })
              });

              if (response.ok) {
                  loadCustomPins(); // Refresh pins
                  document.getElementById('pinForm').reset();
                  document.getElementById('pinControls').classList.add('d-none');
                  addPinMode = false;
                  document.getElementById('addPinBtn').disabled = false;
                  currentMarker.remove();
              }
          } catch (error) {
              console.error('Error saving pin:', error);
          }
      });

      // Map click handler for both pins and restaurants
      map.on('click', async (e) => {
          if (addPinMode) {
              if (currentMarker) currentMarker.remove();
              
              currentMarker = new mapboxgl.Marker({ color: '#FF0000' })
                  .setLngLat([e.lngLat.lng, e.lngLat.lat])
                  .addTo(map);

              document.getElementById('pinControls').classList.remove('d-none');
          }
      });
  }

  // Existing Restaurant Functions
  async function loadRestaurants(lat, lng) {
      try {
          const response = await fetch(`/api/restaurants?lat=${lat}&lng=${lng}`);
          const data = await response.json();

          if (data.results?.length) {
              data.results.forEach(place => {
                  if (place.geometry?.location) {
                      const placeLat = place.geometry.location.lat;
                      const placeLng = place.geometry.location.lng;
                      
                      const marker = new mapboxgl.Marker()
                      .setLngLat([placeLng, placeLat])
                      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
                          <strong>${placeName}</strong><br>
                          <button class="btn btn-primary btn-sm mt-2 create-event-btn" 
                          data-name="${placeName.replace(/"/g, '&quot;')}">
                          Create Event Here
                          </button>
                          `))
                      .addTo(map);

                      savePlaceToDatabase({
                          name: place.name,
                          googlePlaceId: place.place_id,
                          lat: placeLat,
                          lng: placeLng,
                          address: place.vicinity || 'Address unavailable',
                          photo: place.photos?.[0]?.photo_reference 
                              ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=AIzaSyDomEvMi4AHccGjMedgRCeJSFsBEZTaARM`
                              : null
                      });
                  }
              });
          }
      } catch (error) {
          console.error('❌ Error loading restaurants:', error);
      }
  }

  function savePlaceToDatabase(place) {
      fetch('/api/savePlace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(place)
      }).catch(error => console.error('❌ Error saving place:', error));
  }
  document.body.addEventListener('click', (e) => {
    if (e.target.classList.contains('create-event-btn')) {
        const placeName = e.target.dataset.name;
        selectRestaurant(placeName);
    }
  });
  // Start the application
  initializeMap();
});

// Existing restaurant selection function
function selectRestaurant(name) {
  const restaurantInput = document.getElementById('restaurantName');
  const form = document.getElementById('createEventForm');

  if (restaurantInput && form) {
      restaurantInput.value = name;
      form.classList.remove('d-none');
      form.scrollIntoView({ behavior: 'smooth' });
      document.querySelectorAll('.mapboxgl-popup').forEach(popup => {
        popup.remove();
    });
  }
}