#version 420

// required by GLSL spec Sect 4.5.3 (though nvidia does not, amd does)
precision highp float;

layout(binding = 0) uniform sampler2D frameBufferTexture;
layout(binding = 1) uniform sampler2D normalsBufferTexture;
layout(binding = 2) uniform sampler2D depthBufferTexture;

uniform mat4 projectionMatrix;
uniform mat4 inverseProjectionMatrix;
uniform int nof_samples;
uniform float hemisphere_radius;
uniform vec3[] samples;

layout(location = 0) out vec4 fragmentColor;


/**
* Helper function to sample with pixel coordinates, e.g., (511.5, 12.75)
* This functionality is similar to using sampler2DRect.
* TexelFetch only work with integer coordinates and do not perform bilinerar filtering.
*/
vec4 textureRect(in sampler2D tex, vec2 rectangleCoord)
{
	return texture(tex, rectangleCoord / textureSize(tex, 0));
}

vec3 homogenize(vec4 v) { return vec3((1.0 / v.w) * v); }

vec3 computeViewSpacePosition() {
	float fragmentDepth = textureRect(depthBufferTexture, gl_FragCoord.xy).r;

	// Normalized Device Coordinates (clip space)
	vec2 rectangleCoord = gl_FragCoord.xy / textureSize(depthBufferTexture, 0);
	vec4 ndc = vec4(rectangleCoord.x  * 2.0 - 1.0, rectangleCoord.y * 2.0 - 1.0, 
					fragmentDepth * 2.0 - 1.0, 1.0);

	// Transform to view space
	vec3 vs_pos = homogenize(inverseProjectionMatrix * ndc);
	return vs_pos;
}

// Computes one vector in the plane perpendicular to v
vec3 perpendicular(vec3 v)
{
	vec3 av = abs(v); 
	if (av.x < av.y)
		if (av.x < av.z) return vec3(0.0f, -v.z, v.y);
		else return vec3(-v.y, v.x, 0.0f);
	else
		if (av.y < av.z) return vec3(-v.z, 0.0f, v.x);
		else return vec3(-v.y, v.x, 0.0f);
}

float computeHemisphericalVisibility(vec3 vs_pos) {
	int num_visible_samples = 0; 
	int num_valid_samples = 0; 

	vec3 vs_normal = textureRect(normalsBufferTexture, gl_FragCoord.xy).xyz;
	vec3 vs_tangent = perpendicular(vs_normal);
	vec3 vs_bitangent = cross(vs_normal, vs_tangent);

	mat3 tbn = mat3(vs_tangent, vs_bitangent, vs_normal); // local base

	for (int i = 0; i < nof_samples; i++) {
		// Project hemishere sample onto the local base
		vec3 s = tbn * samples[i];

		// compute view-space position of sample
		vec3 vs_sample_position = vs_pos + s * hemisphere_radius;

		// compute the ndc-coords of the sample
		vec3 sample_coords_ndc = homogenize(projectionMatrix * vec4(vs_sample_position, 1.0));

		sample_coords_ndc = (sample_coords_ndc + 1) * 0.5f;

		// Sample the depth-buffer at a texture coord based on the ndc-coord of the sample
		float blocker_depth = texture(depthBufferTexture, sample_coords_ndc.xy).r;

		// Find the view-space coord of the blocker
		vec3 vs_blocker_pos = homogenize(inverseProjectionMatrix * 
			 vec4(s.xy, blocker_depth * 2.0 - 1.0, 1.0));	

		//TODO: actually compute visibility
		num_visible_samples += 1;
		
		// Check that the blocker is closer than hemisphere_radius to vs_pos
		// (otherwise skip this sample)

		// Check if the blocker pos is closer to the camera than our
		// fragment, otherwise, increase num_visible_samples

		num_valid_samples += 1;
	}

	float hemisphericalVisibility = float(num_visible_samples) / float(num_valid_samples);

	if (num_valid_samples == 0)
		hemisphericalVisibility = 1.0;

	return hemisphericalVisibility;
}

void main()
{
	vec3 vs_pos = computeViewSpacePosition();
	float visibility = computeHemisphericalVisibility(vs_pos);

//	fragmentColor = textureRect(normalsBufferTexture, gl_FragCoord.xy);
	//fragmentColor = textureRect(frameBufferTexture, gl_FragCoord.xy);
	fragmentColor = textureRect(frameBufferTexture, gl_FragCoord.xy) * visibility;
}