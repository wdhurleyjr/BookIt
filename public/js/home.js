document.addEventListener('DOMContentLoaded', async function () {
    mapboxgl.accessToken = 'pk.eyJ1Ijoid2RodXJsZXlqciIsImEiOiJjbWEyMjh2MTIwZXA3MmpvbGtrZnBtZGlzIn0.HiCoA6sWpkoi1EDAkb1xeA';
  
    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-122.4194, 37.7749], // Default to San Francisco
      zoom: 13
    });
  
    console.log('Checking for geolocation...');
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
        async function (position) {
            console.log('✅ Geolocation success:', position.coords);
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            map.setCenter([lng, lat]);
            await loadRestaurants(lat, lng);
        },
        async function (error) {
            console.warn('⚠️ Geolocation failed or timed out:', error.message || error);
            console.log('Fallback to San Francisco.');
            map.setCenter([-122.4194, 37.7749]);
            await loadRestaurants(37.7749, -122.4194);
        },
        {
            timeout: 5000, // ⏳ MAXIMUM wait: 5 seconds
            enableHighAccuracy: true // (Optional) Request more accurate location (can be slower)
        }
        );          
    } else {
      console.warn('⚠️ Geolocation not supported by browser.');
      loadRestaurants(37.7749, -122.4194);
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
  