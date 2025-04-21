// Global audio variables (accessible to both setupMicrophone and main)
let audioContext;
let analyzer;
let microphoneStream;
let frequencyData = [];
let lastAudioApplyTime = 0;

// Audio analysis thresholds
const BASS_THRESHOLD = 0.005;    // Lower threshold for bass
const MID_THRESHOLD = 0.01;      // Lower threshold for mids
const TREBLE_THRESHOLD = 0.01;   // Lower threshold for treble

/**
 * Enhanced microphone setup with frequency band analysis
 * @param {Function} callback - Function to call with audio data
 * @param {Object} params - Configuration parameters
 */
function setupMicrophone(callback, params) {
	console.log('Setting up microphone with user gesture handling...');
	
	// Create a full-screen overlay to capture user interaction
	const overlay = document.createElement('div');
	overlay.id = 'audioContextOverlay';
	overlay.style.position = 'fixed';
	overlay.style.top = '0';
	overlay.style.left = '0';
	overlay.style.width = '100%';
	overlay.style.height = '100%';
	overlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
	overlay.style.color = 'white';
	overlay.style.display = 'flex';
	overlay.style.flexDirection = 'column';
	overlay.style.alignItems = 'center';
	overlay.style.justifyContent = 'center';
	overlay.style.zIndex = '10000';
	overlay.style.cursor = 'pointer';
	overlay.style.fontFamily = 'Arial, sans-serif';
	
	const title = document.createElement('h1');
	title.textContent = 'Microphone Access Required';
	title.style.marginBottom = '20px';
	
	const instructions = document.createElement('p');
	instructions.textContent = 'Click anywhere on this page to enable audio processing';
	instructions.style.marginBottom = '30px';
	instructions.style.fontSize = '18px';
	instructions.style.maxWidth = '600px';
	instructions.style.textAlign = 'center';
	
	const note = document.createElement('p');
	note.textContent = 'Chrome requires user interaction before audio can be processed';
	note.style.fontSize = '14px';
	note.style.opacity = '0.7';
	
	overlay.appendChild(title);
	overlay.appendChild(instructions);
	overlay.appendChild(note);
	
	document.body.appendChild(overlay);
	
	// Function to actually initialize the audio context after user gesture
	function initAudioContext() {
	  // Remove the overlay
	  if (document.body.contains(overlay)) {
		document.body.removeChild(overlay);
	  }
	  
	  try {
		// Create audio context
		const AudioContext = window.AudioContext || window.webkitAudioContext;
		console.log('Audio context available:', !!AudioContext);
		
		audioContext = new AudioContext();
		console.log('Audio context created:', audioContext.state);
		
		// Try to resume audio context immediately after user gesture
		if (audioContext.state === 'suspended') {
		  console.log('Resuming audio context after user gesture...');
		  audioContext.resume().then(() => {
			console.log('Audio context resumed successfully');
			continueWithMicrophoneSetup();
		  }).catch(err => {
			console.error('Failed to resume audio context:', err);
		  });
		} else {
		  continueWithMicrophoneSetup();
		}
	  } catch (err) {
		console.error('Error creating audio context:', err);
	  }
	}
	
	// Complete the setup after audio context is ready
	function continueWithMicrophoneSetup() {
	  analyzer = audioContext.createAnalyser();
	  analyzer.fftSize = 2048; // Higher FFT size for better frequency resolution
	  analyzer.smoothingTimeConstant = 0.2; // More responsive
	  analyzer.minDecibels = -90; // Increase sensitivity
	  analyzer.maxDecibels = -10; // Default is -30
	  
	  console.log('Analyzer created with settings:', {
		fftSize: analyzer.fftSize,
		frequencyBinCount: analyzer.frequencyBinCount,
		smoothingTimeConstant: analyzer.smoothingTimeConstant,
		minDecibels: analyzer.minDecibels,
		maxDecibels: analyzer.maxDecibels
	  });
	  
	  const bufferLength = analyzer.frequencyBinCount;
	  const dataArray = new Uint8Array(bufferLength);
	  frequencyData = new Array(bufferLength).fill(0);
	  
	  // Add a status indicator to show microphone levels
	  let statusEl = document.getElementById('micStatus');
	  if (!statusEl) {
		statusEl = document.createElement('div');
		statusEl.id = 'micStatus';
		statusEl.style.position = 'fixed';
		statusEl.style.top = '10px';
		statusEl.style.left = '10px';
		statusEl.style.background = 'rgba(0,0,0,0.5)';
		statusEl.style.color = 'white';
		statusEl.style.padding = '10px';
		statusEl.style.borderRadius = '5px';
		statusEl.style.fontFamily = 'Arial, sans-serif';
		statusEl.style.zIndex = '1000';
		statusEl.textContent = 'Microphone: Initializing...';
		document.body.appendChild(statusEl);
	  }
	  
	  console.log('Requesting microphone access with no processing...');
	  
	  // Request microphone access with explicit settings for maximum sensitivity
	  navigator.mediaDevices.getUserMedia({ 
		audio: {
		  echoCancellation: false,
		  autoGainControl: false,
		  noiseSuppression: false,
		  latency: 0
		}
	  }).then((stream) => {
		console.log('Microphone access granted!');
		
		microphoneStream = stream;
		const source = audioContext.createMediaStreamSource(stream);
		source.connect(analyzer);
		console.log('Microphone connected to analyzer');
		
		statusEl.textContent = 'Microphone: Active';
		statusEl.style.background = 'rgba(0,128,0,0.5)';
		
		// Create our processing function
		function processAudio() {
		  if (!params.useMic) {
			requestAnimationFrame(processAudio);
			return;
		  }
		  
		  analyzer.getByteFrequencyData(dataArray);
		  
		  // Calculate moving average for smoother response
		  for (let i = 0; i < dataArray.length; i++) {
			// Apply exponential moving average (EMA)
			frequencyData[i] = frequencyData[i] * 0.8 + dataArray[i] * 0.2;
		  }
		  
		  // Split frequency range into bass, mid, and treble
		  const bassEnd = Math.floor(dataArray.length * 0.1);     // First 10% of frequencies
		  const midEnd = Math.floor(dataArray.length * 0.5);      // Next 40% of frequencies
		  
		  // Calculate average levels for each range
		  let bassSum = 0;
		  let midSum = 0;
		  let trebleSum = 0;
		  let totalSum = 0;
		  
		  for (let i = 0; i < bassEnd; i++) {
			bassSum += frequencyData[i];
		  }
		  
		  for (let i = bassEnd; i < midEnd; i++) {
			midSum += frequencyData[i];
		  }
		  
		  for (let i = midEnd; i < frequencyData.length; i++) {
			trebleSum += frequencyData[i];
		  }
		  
		  for (let i = 0; i < frequencyData.length; i++) {
			totalSum += frequencyData[i];
		  }
		  
		  const bassLevel = (bassSum / bassEnd) / 256;
		  const midLevel = (midSum / (midEnd - bassEnd)) / 256;
		  const trebleLevel = (trebleSum / (frequencyData.length - midEnd)) / 256;
		  const totalLevel = (totalSum / frequencyData.length) / 256;
		  
		  // Detect beat (sudden increase in low frequency energy)
		  let isBeat = false;
		  const now = Date.now();
		  const timeSinceLastBeat = now - lastAudioApplyTime;
		  
		  // Only check for beats if enough time has passed (to avoid double triggers)
		  if (timeSinceLastBeat > 100 && bassLevel > 0.15 && bassLevel > midLevel * 1.5) {
			isBeat = true;
			lastAudioApplyTime = now;
			console.log('🥁 BEAT detected! Bass level:', bassLevel);
		  }
		  
		  // Update status with audio levels occasionally
		  if (Math.random() < 0.05) { // Update about 3 times per second
			statusEl.textContent = `🎙️ Bass: ${(bassLevel * 100).toFixed(1)}%, Mid: ${(midLevel * 100).toFixed(1)}%, Treble: ${(trebleLevel * 100).toFixed(1)}%`;
			
			// Change color based on audio level
			if (totalLevel > 0.2) {
			  statusEl.style.background = 'rgba(0,255,0,0.8)';
			} else if (totalLevel > 0.05) {
			  statusEl.style.background = 'rgba(0,128,0,0.8)';
			} else if (totalLevel > 0.01) {
			  statusEl.style.background = 'rgba(128,128,0,0.8)';
			} else {
			  statusEl.style.background = 'rgba(128,0,0,0.8)';
			}
		  }
		  
		  // Scale by sensitivity and impact values
		  const bassForce = bassLevel * params.micSensitivity * params.bassImpact;
		  const midForce = midLevel * params.micSensitivity * params.midImpact;
		  const trebleForce = trebleLevel * params.micSensitivity * params.trebleImpact;
		  
		  // Log when we actually have audio (to prevent console spam)
		  if (totalLevel > 0.01) {
			console.log(`🎵 Audio levels - Bass: ${bassLevel.toFixed(4)}, Mid: ${midLevel.toFixed(4)}, Treble: ${trebleLevel.toFixed(4)}, Total: ${totalLevel.toFixed(4)}`);
		  }
		  
		  // Call the original callback with the calculated audio data
		  callback({
			bass: bassForce,
			mid: midForce,
			treble: trebleForce,
			total: totalLevel,
			beat: isBeat,
			threshold: {
			  bass: BASS_THRESHOLD,
			  mid: MID_THRESHOLD,
			  treble: TREBLE_THRESHOLD
			}
		  });
		  
		  requestAnimationFrame(processAudio);
		}
		
		// Start processing
		processAudio();
		
	  }).catch((err) => {
		console.error('Error accessing microphone:', err);
		statusEl.textContent = 'Microphone: Error';
		statusEl.style.background = 'rgba(255,0,0,0.5)';
	  });
	}
	
	// Listen for the user interaction on the overlay
	overlay.addEventListener('click', function handleUserAction() {
	  console.log('User interaction detected, initializing audio context...');
	  initAudioContext();
	  // Remove the event listener to prevent multiple initializations
	  overlay.removeEventListener('click', handleUserAction);
	});
  }

/**
 * Stop and clean up microphone resources
 */
function stopMicrophone() {
  if (microphoneStream) {
    microphoneStream.getTracks().forEach(track => track.stop());
    microphoneStream = null;
  }
  if (audioContext) {
    audioContext.close().catch(e => console.error("Error closing audio context:", e));
    audioContext = null;
  }
}

/**
 * Main function for fluid simulation
 */
function main({ pane, contextID, glslVersion}) {
  const {
    GPUComposer,
    GPUProgram,
    GPULayer,
    SHORT,
    INT,
    FLOAT,
    REPEAT,
    NEAREST,
    LINEAR,
    renderSignedAmplitudeProgram,
  } = GPUIO;

  // Configuration parameters
  const PARAMS = {
    trailLength: 15,
    render: 'Fluid',
    useMic: true,
    micSensitivity: 8.0,     // Increased sensitivity 
    bassImpact: 2.5,         // Increased bass impact
    midImpact: 1.5,          // Increased mid impact
    trebleImpact: 1.0,       // Standard treble impact
  };
  
  // Simulation constants
  const TOUCH_FORCE_SCALE = 2;
  const PARTICLE_DENSITY = 0.1;
  const MAX_NUM_PARTICLES = 10000;
  const PARTICLE_LIFETIME = 1000;
  const NUM_JACOBI_STEPS = 3;
  const PRESSURE_CALC_ALPHA = -1;
  const PRESSURE_CALC_BETA = 0.25;
  const NUM_RENDER_STEPS = 3;
  const VELOCITY_SCALE_FACTOR = 8;
  const MAX_VELOCITY = 30;
  const POSITION_NUM_COMPONENTS = 4;

  let shouldSavePNG = false;

  // Create canvas
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);

  function calcNumParticles(width, height) {
    return Math.min(Math.ceil(width * height * (PARTICLE_DENSITY)), MAX_NUM_PARTICLES);
  }
  let NUM_PARTICLES = calcNumParticles(canvas.width, canvas.height);

  // Initialize GPU composer
  const composer = new GPUComposer({ canvas, contextID, glslVersion });

  // Initialize state layers
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  
  const velocityState = new GPULayer(composer, {
    name: 'velocity',
    dimensions: [Math.ceil(width / VELOCITY_SCALE_FACTOR), Math.ceil(height / VELOCITY_SCALE_FACTOR)],
    type: FLOAT,
    filter: LINEAR,
    numComponents: 2,
    wrapX: REPEAT,
    wrapY: REPEAT,
    numBuffers: 2,
  });
  
  const divergenceState = new GPULayer(composer, {
    name: 'divergence',
    dimensions: [velocityState.width, velocityState.height],
    type: FLOAT,
    filter: NEAREST,
    numComponents: 1,
    wrapX: REPEAT,
    wrapY: REPEAT,
  });
  
  const pressureState = new GPULayer(composer, {
    name: 'pressure',
    dimensions: [velocityState.width, velocityState.height],
    type: FLOAT,
    filter: NEAREST,
    numComponents: 1,
    wrapX: REPEAT,
    wrapY: REPEAT,
    numBuffers: 2,
  });
  
  const particlePositionState = new GPULayer(composer, {
    name: 'position',
    dimensions: NUM_PARTICLES,
    type: FLOAT,
    numComponents: POSITION_NUM_COMPONENTS,
    numBuffers: 2,
  });
  
  const particleInitialState = new GPULayer(composer, {
    name: 'initialPosition',
    dimensions: NUM_PARTICLES,
    type: FLOAT,
    numComponents: POSITION_NUM_COMPONENTS,
    numBuffers: 1,
  });
  
  const particleAgeState = new GPULayer(composer, {
    name: 'age',
    dimensions: NUM_PARTICLES,
    type: SHORT,
    numComponents: 1,
    numBuffers: 2,
  });
  
  const trailState = new GPULayer(composer, {
    name: 'trails',
    dimensions: [canvas.width, canvas.height],
    type: FLOAT,
    filter: NEAREST,
    numComponents: 1,
    numBuffers: 2,
  });

  // Define GPU programs
  const advection = new GPUProgram(composer, {
    name: 'advection',
    fragmentShader: `
    in vec2 v_uv;

    uniform sampler2D u_state;
    uniform sampler2D u_velocity;
    uniform vec2 u_dimensions;

    out vec2 out_state;

    void main() {
      // Implicitly solve advection.
      out_state = texture(u_state, v_uv - texture(u_velocity, v_uv).xy / u_dimensions).xy;
    }`,
    uniforms: [
      {
        name: 'u_state',
        value: 0,
        type: INT,
      },
      {
        name: 'u_velocity',
        value: 1,
        type: INT,
      },
      {
        name: 'u_dimensions',
        value: [canvas.width, canvas.height],
        type: FLOAT,
      },
    ],
  });
  
  const divergence2D = new GPUProgram(composer, {
    name: 'divergence2D',
    fragmentShader: `
    in vec2 v_uv;

    uniform sampler2D u_vectorField;
    uniform vec2 u_pxSize;

    out float out_divergence;

    void main() {
      float n = texture(u_vectorField, v_uv + vec2(0, u_pxSize.y)).y;
      float s = texture(u_vectorField, v_uv - vec2(0, u_pxSize.y)).y;
      float e = texture(u_vectorField, v_uv + vec2(u_pxSize.x, 0)).x;
      float w = texture(u_vectorField, v_uv - vec2(u_pxSize.x, 0)).x;
      out_divergence = 0.5 * ( e - w + n - s);
    }`,
    uniforms: [
      {
        name: 'u_vectorField',
        value: 0,
        type: INT,
      },
      {
        name: 'u_pxSize',
        value: [1 / velocityState.width, 1 / velocityState.height],
        type: FLOAT,
      }
    ],
  });
  
  const jacobi = new GPUProgram(composer, {
    name: 'jacobi',
    fragmentShader: `
    in vec2 v_uv;

    uniform float u_alpha;
    uniform float u_beta;
    uniform vec2 u_pxSize;
    uniform sampler2D u_previousState;
    uniform sampler2D u_divergence;

    out vec4 out_jacobi;

    void main() {
      vec4 n = texture(u_previousState, v_uv + vec2(0, u_pxSize.y));
      vec4 s = texture(u_previousState, v_uv - vec2(0, u_pxSize.y));
      vec4 e = texture(u_previousState, v_uv + vec2(u_pxSize.x, 0));
      vec4 w = texture(u_previousState, v_uv - vec2(u_pxSize.x, 0));
      vec4 d = texture(u_divergence, v_uv);
      out_jacobi = (n + s + e + w + u_alpha * d) * u_beta;
    }`,
    uniforms: [
      {
        name: 'u_alpha',
        value: PRESSURE_CALC_ALPHA,
        type: FLOAT,
      },
      {
        name: 'u_beta',
        value: PRESSURE_CALC_BETA,
        type: FLOAT,
      },
      {
        name: 'u_pxSize',
        value: [1 / velocityState.width, 1 / velocityState.height],
        type: FLOAT,
      },
      {
        name: 'u_previousState',
        value: 0,
        type: INT,
      },
      {
        name: 'u_divergence',
        value: 1,
        type: INT,
      },
    ],
  });
  
  const gradientSubtraction = new GPUProgram(composer, {
    name: 'gradientSubtraction',
    fragmentShader: `
    in vec2 v_uv;

    uniform vec2 u_pxSize;
    uniform sampler2D u_scalarField;
    uniform sampler2D u_vectorField;

    out vec2 out_result;

    void main() {
      float n = texture(u_scalarField, v_uv + vec2(0, u_pxSize.y)).r;
      float s = texture(u_scalarField, v_uv - vec2(0, u_pxSize.y)).r;
      float e = texture(u_scalarField, v_uv + vec2(u_pxSize.x, 0)).r;
      float w = texture(u_scalarField, v_uv - vec2(u_pxSize.x, 0)).r;

      out_result = texture2D(u_vectorField, v_uv).xy - 0.5 * vec2(e - w, n - s);
    }`,
    uniforms: [
      {
        name: 'u_pxSize',
        value: [1 / velocityState.width, 1 / velocityState.height],
        type: FLOAT,
      },
      {
        name: 'u_scalarField',
        value: 0,
        type: INT,
      },
      {
        name: 'u_vectorField',
        value: 1,
        type: INT,
      },
    ],
  });
  
  const renderParticles = new GPUProgram(composer, {
    name: 'renderParticles',
    fragmentShader: `
    #define FADE_TIME 0.1

    in vec2 v_uv;
    in vec2 v_uv_position;

    uniform isampler2D u_ages;
    uniform sampler2D u_velocity;

    out float out_state;

    void main() {
      float ageFraction = float(texture(u_ages, v_uv_position).x) / ${PARTICLE_LIFETIME.toFixed(1)};
      // Fade first 10% and last 10%.
      float opacity = mix(0.0, 1.0, min(ageFraction * 10.0, 1.0)) * mix(1.0, 0.0, max(ageFraction * 10.0 - 90.0, 0.0));
      vec2 velocity = texture(u_velocity, v_uv).xy;
      // Show the fastest regions with darker color.
      float multiplier = clamp(dot(velocity, velocity) * 0.05 + 0.7, 0.0, 1.0);
      out_state = opacity * multiplier;
    }`,
    uniforms: [
      {
        name: 'u_ages',
        value: 0,
        type: INT,
      },
      {
        name: 'u_velocity',
        value: 1,
        type: INT,
      },
    ],
  });
  
  const ageParticles = new GPUProgram(composer, {
    name: 'ageParticles',
    fragmentShader: `
    in vec2 v_uv;

    uniform isampler2D u_ages;

    out int out_age;

    void main() {
      int age = texture(u_ages, v_uv).x + 1;
      out_age = stepi(age, ${PARTICLE_LIFETIME}) * age;
    }`,
    uniforms: [
      {
        name: 'u_ages',
        value: 0,
        type: INT,
      },
    ],
  });
  
  const advectParticles = new GPUProgram(composer, {
    name: 'advectParticles',
    fragmentShader: `
    in vec2 v_uv;

    uniform vec2 u_dimensions;
    uniform sampler2D u_positions;
    uniform sampler2D u_velocity;
    uniform isampler2D u_ages;
    uniform sampler2D u_initialPositions;

    out vec4 out_position;

    void main() {
      // Store small displacements as separate number until they accumulate sufficiently.
      // Then add them to the absolution position.
      // This prevents small offsets on large abs positions from being lost in float16 precision.
      vec4 positionData = texture(u_positions, v_uv);
      vec2 absolute = positionData.rg;
      vec2 displacement = positionData.ba;
      vec2 position = absolute + displacement;

      // Forward integrate via RK2.
      vec2 pxSize = 1.0 / u_dimensions;
      vec2 velocity1 = texture(u_velocity, position * pxSize).xy;
      vec2 halfStep = position + velocity1 * 0.5 * ${1 / NUM_RENDER_STEPS};
      vec2 velocity2 = texture(u_velocity, halfStep * pxSize).xy;
      displacement += velocity2 * ${1 / NUM_RENDER_STEPS};

      // Merge displacement with absolute if needed.
      float shouldMerge = step(20.0, dot(displacement, displacement));
      // Also wrap absolute position if needed.
      absolute = mod(absolute + shouldMerge * displacement + u_dimensions, u_dimensions);
      displacement *= (1.0 - shouldMerge);

      // If this particle is being reset, give it a random position.
      int shouldReset = stepi(texture(u_ages, v_uv).x, 1);
      out_position = mix(vec4(absolute, displacement), texture(u_initialPositions, v_uv), float(shouldReset));
    }`,
    uniforms: [
      {
        name: 'u_positions',
        value: 0,
        type: INT,
      },
      {
        name: 'u_velocity',
        value: 1,
        type: INT,
      },
      {
        name: 'u_ages',
        value: 2,
        type: INT,
      },
      {
        name: 'u_initialPositions',
        value: 3,
        type: INT,
      },
      {
        name: 'u_dimensions',
        value: [canvas.width, canvas.height],
        type: 'FLOAT',
      },
    ],
  });
  
  const fadeTrails = new GPUProgram(composer, {
    name: 'fadeTrails',
    fragmentShader: `
    in vec2 v_uv;

    uniform sampler2D u_image;
    uniform float u_increment;

    out float out_color;

    void main() {
      out_color = max(texture(u_image, v_uv).x + u_increment, 0.0);
    }`,
    uniforms: [
      {
        name: 'u_image',
        value: 0,
        type: INT,
      },
      {
        name: 'u_increment',
        value: -1 / PARAMS.trailLength,
        type: 'FLOAT',
      },
    ],
  });
  
  const renderTrails = new GPUProgram(composer, {
    name: 'renderTrails',
    fragmentShader: `
      in vec2 v_uv;
      uniform sampler2D u_trailState;
      out vec4 out_color;
      void main() {
        vec3 background = vec3(0.98, 0.922, 0.843);
        vec3 particle = vec3(0, 0, 0.2);
        out_color = vec4(mix(background, particle, texture(u_trailState, v_uv).x), 1);
      }
    `,
  });
  
  const renderPressure = renderSignedAmplitudeProgram(composer, {
    name: 'renderPressure',
    type: pressureState.type,
    scale: 0.5,
    component: 'x',
  });

  // Touch interaction program
  const touch = new GPUProgram(composer, {
    name: 'touch',
    fragmentShader: `
    in vec2 v_uv;
    in vec2 v_uv_local;

    uniform sampler2D u_velocity;
    uniform vec2 u_vector;

    out vec2 out_velocity;

    void main() {
      vec2 radialVec = (v_uv_local * 2.0 - 1.0);
      float radiusSq = dot(radialVec, radialVec);
      vec2 velocity = texture(u_velocity, v_uv).xy + (1.0 - radiusSq) * u_vector * ${TOUCH_FORCE_SCALE.toFixed(1)};
      float velocityMag = length(velocity);
      out_velocity = velocity / velocityMag * min(velocityMag, ${MAX_VELOCITY.toFixed(1)});
    }`,
    uniforms: [
      {
        name: 'u_velocity',
        value: 0,
        type: INT,
      },
      {
        name: 'u_vector',
        value: [0, 0],
        type: FLOAT,
      },
    ],
  });

  // Main render loop
  function loop() {
    // Advect the velocity vector field.
    composer.step({
      program: advection,
      input: [velocityState, velocityState],
      output: velocityState,
    });
    
    // Compute divergence of advected velocity field.
    composer.step({
      program: divergence2D,
      input: velocityState,
      output: divergenceState,
    });
    
    // Compute the pressure gradient of the advected velocity vector field (using jacobi iterations).
    for (let i = 0; i < NUM_JACOBI_STEPS; i++) {
      composer.step({
        program: jacobi,
        input: [pressureState, divergenceState],
        output: pressureState,
      });
    }
    
    // Subtract the pressure gradient from velocity to obtain a velocity vector field with zero divergence.
    composer.step({
      program: gradientSubtraction,
      input: [pressureState, velocityState],
      output: velocityState,
    });

    if (PARAMS.render === 'Pressure') {
      composer.step({
        program: renderPressure,
        input: pressureState,
      });
    } else if (PARAMS.render === 'Velocity') {
      composer.drawLayerAsVectorField({
        layer: velocityState,
        vectorSpacing: 10,
        vectorScale: 2.5,
        color: [0, 0, 0],
      });
    } else {
      // Increment particle age.
      composer.step({
        program: ageParticles,
        input: particleAgeState,
        output: particleAgeState,
      });
      
      // Fade current trails.
      composer.step({
        program: fadeTrails,
        input: trailState,
        output: trailState,
      });
      
      for (let i = 0; i < NUM_RENDER_STEPS; i++) {
        // Advect particles.
        composer.step({
          program: advectParticles,
          input: [particlePositionState, velocityState, particleAgeState, particleInitialState],
          output: particlePositionState,
        });
        
        // Render particles to texture for trail effect.
        composer.drawLayerAsPoints({
          layer: particlePositionState,
          program: renderParticles,
          input: [particleAgeState, velocityState],
          output: trailState,
          wrapX: true,
          wrapY: true,
        });
      }
      
      // Render particle trails to screen.
      composer.step({
        program: renderTrails,
        input: trailState,
      });
    }
    
    if (shouldSavePNG) {
      composer.savePNG({ filename: `fluid` });
      shouldSavePNG = false;
    }
  }

  // Setup microphone with enhanced audio processing
  setupMicrophone(audioData => {
    if (!PARAMS.useMic) return;
    
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    // Bass - center force radiating outward (big pulse on beat)
    if (audioData.bass > audioData.threshold.bass) {
      const centerX = width / 2;
      const centerY = height / 2;
      
      // On beat, create a strong pulse
      if (audioData.beat) {
        const numPoints = 8;
        const radius = Math.min(width, height) * 0.2;
        
        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          const forceX = Math.cos(angle) * audioData.bass * 25;
          const forceY = Math.sin(angle) * audioData.bass * 25;
          
          touch.setUniform('u_vector', [forceX, forceY]);
          composer.stepSegment({
            program: touch,
            input: velocityState,
            output: velocityState,
            position1: [x, canvas.clientHeight - y],
            position2: [x + 1, canvas.clientHeight - y + 1],
            thickness: 50 + audioData.bass * 60,
            endCaps: true,
          });
        }
      } 
      // Regular bass response
      else {
        const force = [0, -audioData.bass * 15]; // Up direction with stronger impact
        
        touch.setUniform('u_vector', force);
        composer.stepSegment({
          program: touch,
          input: velocityState,
          output: velocityState,
          position1: [centerX, canvas.clientHeight - centerY],
          position2: [centerX + 1, canvas.clientHeight - centerY + 1],
          thickness: 40 + audioData.bass * 40,
          endCaps: true,
        });
      }
    }
    
    // Mid - circular forces with rotation
    if (audioData.mid > audioData.threshold.mid) {
      const numPoints = 6;
      const radius = Math.min(width, height) * 0.35;
      // Add slow rotation based on time
      const rotation = (Date.now() * 0.0005) % (Math.PI * 2);
      
      for (let i = 0; i < numPoints; i++) {
        const angle = rotation + (i / numPoints) * Math.PI * 2;
        const x = width / 2 + Math.cos(angle) * radius;
        const y = height / 2 + Math.sin(angle) * radius;
        // Force direction rotating outward
        const forceX = Math.cos(angle) * audioData.mid * 12;
        const forceY = Math.sin(angle) * audioData.mid * 12;
        
        touch.setUniform('u_vector', [forceX, forceY]);
        composer.stepSegment({
          program: touch,
          input: velocityState,
          output: velocityState,
          position1: [x, canvas.clientHeight - y],
		  position2: [x + 1, canvas.clientHeight - y + 1],
          thickness: 25 + audioData.mid * 30,
          endCaps: true,
        });
      }
    }
    
    // Treble - random patterns with more variance
    if (audioData.treble > audioData.threshold.treble) {
      const numPoints = Math.floor(audioData.treble * 15) + 1; // More points
      
      for (let i = 0; i < numPoints; i++) {
        // Create points around the edges to push inward sometimes
        let x, y, forceX, forceY;
        
        if (Math.random() < 0.7) {
          // Random position
          x = Math.random() * width;
          y = Math.random() * height;
          const angle = Math.random() * Math.PI * 2;
          forceX = Math.cos(angle) * audioData.treble * 8;
          forceY = Math.sin(angle) * audioData.treble * 8;
        } else {
          // Edge-based force pushing inward
          const edge = Math.floor(Math.random() * 4); // 0-3 for top, right, bottom, left
          switch(edge) {
            case 0: // top
              x = Math.random() * width;
              y = 0;
              forceX = 0;
              forceY = audioData.treble * 10;
              break;
            case 1: // right
              x = width;
              y = Math.random() * height;
              forceX = -audioData.treble * 10;
              forceY = 0;
              break;
            case 2: // bottom
              x = Math.random() * width;
              y = height;
              forceX = 0;
              forceY = -audioData.treble * 10;
              break;
            case 3: // left
              x = 0;
              y = Math.random() * height;
              forceX = audioData.treble * 10;
              forceY = 0;
              break;
          }
        }
        
        touch.setUniform('u_vector', [forceX, forceY]);
        composer.stepSegment({
          program: touch,
          input: velocityState,
          output: velocityState,
          position1: [x, canvas.clientHeight - y],
          position2: [x + 1, canvas.clientHeight - y + 1],
          thickness: 15 + audioData.treble * 20,
          endCaps: true,
        });
      }
    }
    
    // Always apply a small ambient force to keep things moving
    if (audioData.total > 0.01) {
      const angle = Date.now() * 0.001; // Slowly rotating force
      const ambientForce = 0.3 + audioData.total * 0.5;
      const forceX = Math.cos(angle) * ambientForce;
      const forceY = Math.sin(angle) * ambientForce;
      
      touch.setUniform('u_vector', [forceX, forceY]);
      composer.stepSegment({
        program: touch,
        input: velocityState,
        output: velocityState,
        position1: [width/2, canvas.clientHeight - height/2],
        position2: [(width/2) + 1, canvas.clientHeight - (height/2) + 1],
        thickness: 25,
        endCaps: true,
      });
    }
  }, PARAMS); // Pass PARAMS to setupMicrophone

  // Touch events for mouse/pointer interaction
  const activeTouches = {};
  
  function onPointerMove(e) {
    const x = e.clientX;
    const y = e.clientY;
    
    if (activeTouches[e.pointerId] === undefined) {
      activeTouches[e.pointerId] = {
        current: [x, y],
      }
      return;
    }
    
    activeTouches[e.pointerId].last = activeTouches[e.pointerId].current;
    activeTouches[e.pointerId].current = [x, y];

    const { current, last } = activeTouches[e.pointerId];
    if (current[0] == last[0] && current[1] == last[1]) {
      return;
    }
    
    touch.setUniform('u_vector', [current[0] - last[0], - (current[1] - last[1])]);
    composer.stepSegment({
      program: touch,
      input: velocityState,
      output: velocityState,
      position1: [current[0], canvas.clientHeight - current[1]],
      position2: [last[0], canvas.clientHeight - last[1]],
      thickness: 30,
      endCaps: true,
    });
  }
  
  function onPointerStop(e) {
    delete activeTouches[e.pointerId];
  }
  
  // Add event listeners for touch/mouse interaction
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerStop);
  canvas.addEventListener('pointerout', onPointerStop);
  canvas.addEventListener('pointercancel', onPointerStop);

  // Set up UI controls
  const ui = [];
  
  ui.push(pane.addInput(PARAMS, 'trailLength', { 
    min: 0, 
    max: 100, 
    step: 1, 
    label: 'Trail Length' 
  }).on('change', () => {
    fadeTrails.setUniform('u_increment', -1 / PARAMS.trailLength);
  }));
  
  ui.push(pane.addInput(PARAMS, 'render', {
    options: {
      Fluid: 'Fluid',
      Pressure: 'Pressure',
      Velocity: 'Velocity',
    },
    label: 'Render',
  }));
  
  // Add audio controls folder
  const audioFolder = pane.addFolder({ title: 'Audio Controls' });
  
  audioFolder.addInput(PARAMS, 'useMic', { label: 'Use Microphone' });
  
  audioFolder.addInput(PARAMS, 'micSensitivity', { 
    min: 1.0, 
    max: 20.0, 
    step: 0.5, 
    label: 'Mic Sensitivity' 
  });
  
  audioFolder.addInput(PARAMS, 'bassImpact', { 
    min: 0.0, 
    max: 5.0, 
    step: 0.1, 
    label: 'Bass Impact' 
  });
  
  audioFolder.addInput(PARAMS, 'midImpact', { 
    min: 0.0, 
    max: 5.0, 
    step: 0.1, 
    label: 'Mid Impact' 
  });
  
  audioFolder.addInput(PARAMS, 'trebleImpact', { 
    min: 0.0, 
    max: 5.0, 
    step: 0.1, 
    label: 'Treble Impact' 
  });
  
  ui.push(pane.addButton({ title: 'Reset' }).on('click', onResize));
  ui.push(pane.addButton({ title: 'Save PNG (p)' }).on('click', savePNG));

  // Add 'p' hotkey to save PNG
  function savePNG() {
    shouldSavePNG = true;
  }
  
  window.addEventListener('keydown', onKeydown);
  
  function onKeydown(e) {
    if (e.key === 'p') {
      savePNG();
    }
  }

  // Handle resizing
  window.addEventListener('resize', onResize);
  
  function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Resize composer
    composer.resize([width, height]);

    // Re-init textures at new size
    const velocityDimensions = [Math.ceil(width / VELOCITY_SCALE_FACTOR), Math.ceil(height / VELOCITY_SCALE_FACTOR)];
    velocityState.resize(velocityDimensions);
    divergenceState.resize(velocityDimensions);
    pressureState.resize(velocityDimensions);
    trailState.resize([width, height]);

    // Update uniforms
    advection.setUniform('u_dimensions', [width, height]);
    advectParticles.setUniform('u_dimensions', [width, height]);
    const velocityPxSize = [1 / velocityDimensions[0], 1 / velocityDimensions[1]];
    divergence2D.setUniform('u_pxSize', velocityPxSize);
    jacobi.setUniform('u_pxSize', velocityPxSize);
    gradientSubtraction.setUniform('u_pxSize', velocityPxSize);
    
    // Re-init particles
    NUM_PARTICLES = calcNumParticles(width, height);
    
    // Init new positions
    const positions = new Float32Array(NUM_PARTICLES * 4);
    for (let i = 0; i < positions.length / 4; i++) {
      positions[POSITION_NUM_COMPONENTS * i] = Math.random() * width;
      positions[POSITION_NUM_COMPONENTS * i + 1] = Math.random() * height;
    }
    particlePositionState.resize(NUM_PARTICLES, positions);
    particleInitialState.resize(NUM_PARTICLES, positions);
    
    // Init new ages
    const ages = new Int16Array(NUM_PARTICLES);
    for (let i = 0; i < NUM_PARTICLES; i++) {
      ages[i] = Math.round(Math.random() * PARTICLE_LIFETIME);
    }
    particleAgeState.resize(NUM_PARTICLES, ages);
  }
  
  // Initial resize to fit window
  onResize();

  // Cleanup function
  function dispose() {
    // Stop microphone
    stopMicrophone();
    
    // Remove event listeners
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('resize', onResize);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerStop);
    canvas.removeEventListener('pointerout', onPointerStop);
    canvas.removeEventListener('pointercancel', onPointerStop);
    
    // Remove canvas
    document.body.removeChild(canvas);
    
    // Dispose GPU resources
    velocityState.dispose();
    divergenceState.dispose();
    pressureState.dispose();
    particlePositionState.dispose();
    particleInitialState.dispose();
    particleAgeState.dispose();
    trailState.dispose();
    advection.dispose();
    divergence2D.dispose();
    jacobi.dispose();
    gradientSubtraction.dispose();
    renderParticles.dispose();
    ageParticles.dispose();
    advectParticles.dispose();
    renderTrails.dispose();
    fadeTrails.dispose();
    renderPressure.dispose();
    touch.dispose();
    composer.dispose();
    
    // Clean up UI
    ui.forEach(el => {
      pane.remove(el);
    });
    ui.length = 0;
  }

  // Add cleanup handler for page unload
  function handleBeforeUnload() {
    stopMicrophone();
  }
  
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Return the public API
  return {
    loop,
    dispose,
    composer,
    canvas,
  };
}

// Export the main function
if (typeof module !== 'undefined') {
  module.exports = { main, setupMicrophone, stopMicrophone };
}