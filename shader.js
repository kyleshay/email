const shaderSource = `
// remix https://www.shadertoy.com/view/Mdf3z7
#define MaxSteps 20
#define MinimumDistance 0.0009
#define normalDistance 0.0002

#define Iterations 7
#define PI 3.141592
#define Scale 3.0
#define FieldOfView 1.0
#define Jitter 0.005
#define FudgeFactor 0.7
#define NonLinearPerspective 3.0
#define DebugNonlinearPerspective false

#define Ambient .732184
#define Diffuse 1.05
#define LightDir vec3(1.0)
#define LightColor vec3(1.0,.10,0.0858824)
#define LightDir2 vec3(1.0,-1.0,1.0)
#define LightColor2 vec3(.5,0.333333,.0)
#define Offset vec3(0.92858,0.92858,0.32858)

vec2 rotate(vec2 v, float a) {
	return vec2(cos(a)*v.x + sin(a)*v.y, -sin(a)*v.x + cos(a)*v.y);
}

// Two light sources. No specular 
vec3 getLight(in vec3 color, in vec3 normal, in vec3 dir) {
	vec3 lightDir = normalize(LightDir);
	float diffuse = max(0.0,dot(-normal, lightDir)); // Lambertian
	
	vec3 lightDir2 = normalize(LightDir2);
	float diffuse2 = max(0.0,dot(-normal, lightDir2)); // Lambertian
	
	return
	(diffuse*Diffuse)*(LightColor*color) +
	(diffuse2*Diffuse)*(LightColor2*color);
}


// DE: Infinitely tiled Menger IFS.
//
// For more info on KIFS, see:
// http://www.fractalforums.com/3d-fractal-generation/kaleidoscopic-%28escape-time-ifs%29/
float DE(in vec3 z)
{
	// enable this to debug the non-linear perspective
	if (DebugNonlinearPerspective) {
		z = fract(z);
		float d=length(z.xy-vec2(0.5));
		d = min(d, length(z.xz-vec2(0.5)));
		d = min(d, length(z.yz-vec2(0.5)));
		return d-0.01;
	}
	// Folding 'tiling' of 3D space;
	z  = abs(1.0-mod(z,2.0));

	float d = 1000.0;
	for (int n = 0; n < Iterations; n++) {
		if (n - 1 > int(mouseX * 7.) + 1) {
			continue;
		}
		z.xy = rotate(z.xy,4.0+2.0*cos( time/8.0));		
		z = abs(z);
		if (z.x<z.y){ z.xy = z.yx;}
		if (z.x< z.z){ z.xz = z.zx;}
		if (z.y<z.z){ z.yz = z.zy;}
		z = Scale*z-Offset*(Scale-1.0);
		if( z.z<-0.5*Offset.z*(Scale-1.0))  z.z+=Offset.z*(Scale-1.0);
		d = min(d, length(z) * pow(Scale, float(-n)-1.0));
	}
	
	return d-0.001;
}

// Finite difference normal
vec3 getNormal(in vec3 pos) {
	vec3 e = vec3(0.0,normalDistance,0.0);
	
	return normalize(vec3(
			DE(pos+e.yxx)-DE(pos-e.yxx),
			DE(pos+e.xyx)-DE(pos-e.xyx),
			DE(pos+e.xxy)-DE(pos-e.xxy)
			)
		);
}

// Solid color 
vec3 getColor(vec3 normal, vec3 pos) {
	return vec3(mouseY, -mouseY, .5) * -1.;
	// return vec3(1.);
}


// Pseudo-random number
// From: lumina.sourceforge.net/Tutorials/Noise.html
float rand(vec2 co){
	return fract(cos(dot(co,vec2(4.898,7.23))) * 23421.631);
}

vec4 rayMarch(in vec3 from, in vec3 dir, in vec2 fragCoord) {
	// Add some noise to prevent banding
	float totalDistance = Jitter*rand(fragCoord.xy+vec2(time));
	vec3 dir2 = dir;
	float distance;
	int steps = 0;
	vec3 pos;
	for (int i=0; i < MaxSteps; i++) {
		// Non-linear perspective applied here.
		dir.zy = rotate(dir2.zy,totalDistance*cos( time/4.0)*NonLinearPerspective);
		
		pos = from + totalDistance * dir;
		distance = DE(pos)*FudgeFactor;
		totalDistance += distance;
		if (distance < MinimumDistance) break;
		steps = i;
	}
	
	// 'AO' is based on number of steps.
	// Try to smooth the count, to combat banding.
	float smoothStep =   float(steps) + distance/MinimumDistance;
	float ao = 1.1-smoothStep*clicked/float(MaxSteps);
	
	// Since our distance field is not signed,
	// backstep when calc'ing normal
	vec3 normal = getNormal(pos-dir*normalDistance*3.0);
	
	vec3 color = getColor(normal, pos);
	vec3 light = getLight(color, normal, dir);
	color = (color*Ambient+light)*ao;
	return vec4(color,1.0);
}

void main()
{
	// Camera position (eye), and camera target
	float offset = distance(vec2(.5, .5), vec2(mouseX, mouseY)) > .05 ? .25 : .5;
	vec3 camPos = 0.5*time*vec3(1.0,0.0,0.0)*offset;
	vec3 target = camPos + vec3(1.0,0.0*cos(time)+(.5-mouseY)*4.,0.0*sin(0.4*time)+(.5-mouseX)*4.) ;
	vec3 camUp  = vec3(0.0,1.0,0.0);
	
	// Calculate orthonormal camera reference system
	vec3 camDir = normalize(target-camPos); // direction for center ray
	camUp = normalize(camUp-dot(camDir,camUp)*camDir); // orthogonalize
	vec3 camRight = normalize(cross(camDir,camUp));
	
	vec2 coord =-1.0+2.0*gl_FragCoord.xy/resolution.xy;
	coord.x *= resolution.x/resolution.y;
	
	// Get direction for this pixel
	vec3 rayDir = normalize(camDir + (coord.x*camRight + coord.y*camUp)*FieldOfView);
	

	gl_FragColor = rayMarch(camPos, rayDir, gl_FragCoord.xy );
}
`;
