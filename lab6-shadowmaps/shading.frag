#version 420

// required by GLSL spec Sect 4.5.3 (though nvidia does not, amd does)
precision highp float;

///////////////////////////////////////////////////////////////////////////////
// Material
///////////////////////////////////////////////////////////////////////////////
uniform vec3 material_color;
uniform float material_reflectivity;
uniform float material_metalness;
uniform float material_fresnel;
uniform float material_shininess;
uniform float material_emission;

uniform int has_emission_texture;
layout(binding = 5) uniform sampler2D emissiveMap;

///////////////////////////////////////////////////////////////////////////////
// Environment
///////////////////////////////////////////////////////////////////////////////
layout(binding = 6) uniform sampler2D environmentMap;
layout(binding = 7) uniform sampler2D irradianceMap;
layout(binding = 8) uniform sampler2D reflectionMap;
uniform float environment_multiplier;

///////////////////////////////////////////////////////////////////////////////
// Light source
///////////////////////////////////////////////////////////////////////////////
uniform vec3 point_light_color = vec3(1.0, 1.0, 1.0);
uniform float point_light_intensity_multiplier = 50.0;

///////////////////////////////////////////////////////////////////////////////
// Constants
///////////////////////////////////////////////////////////////////////////////
#define PI 3.14159265359

///////////////////////////////////////////////////////////////////////////////
// Input varyings from vertex shader
///////////////////////////////////////////////////////////////////////////////
in vec2 texCoord;
in vec3 viewSpaceNormal;
in vec3 viewSpacePosition;

///////////////////////////////////////////////////////////////////////////////
// Input uniform variables
///////////////////////////////////////////////////////////////////////////////
uniform mat4 viewInverse;
uniform vec3 viewSpaceLightPosition;

///////////////////////////////////////////////////////////////////////////////
// Output color
///////////////////////////////////////////////////////////////////////////////
layout(location = 0) out vec4 fragmentColor;



vec3 calculateDirectIllumiunation(vec3 wo, vec3 n)
{
	float d = distance(viewSpaceLightPosition, viewSpacePosition);
	vec3 wi = normalize(viewSpaceLightPosition - viewSpacePosition);
	vec3 direct_illum = (dot(n, wi) <= 0) ? 
					vec3(0) : 
					point_light_intensity_multiplier * point_light_color * (1.0f / pow(d, 2));
		
	vec3 diffuse_term = material_color * 1.0f/PI * abs(dot(n, wi)) * direct_illum;
	vec3 wh = normalize(wi + wo);
	
	float D = max(0, ((material_shininess + 2) / (2 * PI)) * pow(dot(n, wh), material_shininess));
	float G = min(1, min((2 * dot(n, wh) * dot(n, wo)) / dot(wo, wh), (2 * dot(n, wh) * dot(n, wi)) / dot(wo, wh)));
	float F = material_fresnel + (1 - material_fresnel) * pow((1 - dot(wh, wi)), 5);
	float brdf = (F*D*G)/(4*dot(n, wo)*dot(n, wi));
	
	vec3 dielectric_term = brdf * dot(n, wi) * direct_illum + (1-F) * diffuse_term;
	vec3 metal_term = brdf * material_color * dot(n, wi) * direct_illum;
	vec3 microfacet_term = material_metalness * metal_term + (1-material_metalness) * dielectric_term;

	return material_reflectivity * microfacet_term + (1-material_reflectivity) * diffuse_term;
}

vec3 calculateIndirectIllumination(vec3 wo, vec3 n)
{
	vec3 indirect_illum = vec3(0.f);
	vec4 dir = normalize(viewInverse * vec4(n,0));

	// Calculate the spherical coordinates of the direction
	float theta = acos(max(-1.0f, min(1.0f, dir.y)));
	float phi = atan(dir.z, dir.x);
	if(phi < 0.0f)
	{
		phi = phi + 2.0f * PI;
	}

	// Use these to lookup the color in the environment map
	vec2 lookup = vec2(phi / (2.0 * PI), theta / PI);
	indirect_illum = environment_multiplier * texture(irradianceMap, lookup).xyz;
	vec3 diffuse_term = material_color * (1.0 / PI) * indirect_illum;

	vec3 wi = normalize(reflect(wo, normalize(n)));
	float roughness = sqrt(sqrt(2/(material_shininess + 2)));
	indirect_illum = environment_multiplier * textureLod(reflectionMap, lookup, roughness * 7.0).xyz;

	vec3 wh = normalize(wi + wo);
	float F = material_fresnel + (1 - material_fresnel) * pow((1 - dot(wh, wi)), 5);

	vec3 dielectric_term = F * indirect_illum + (1-F) * diffuse_term;
	vec3 metal_term = F * material_color * indirect_illum;
	vec3 microfacet_term = material_metalness * metal_term + (1-material_metalness) * dielectric_term;

	return material_reflectivity * microfacet_term + (1-material_reflectivity) * diffuse_term;
}

void main()
{
	float visibility = 1.0;
	float attenuation = 1.0;


	vec3 wo = -normalize(viewSpacePosition);
	vec3 n = normalize(viewSpaceNormal);

	// Direct illumination
	vec3 direct_illumination_term = visibility * calculateDirectIllumiunation(wo, n);

	// Indirect illumination
	vec3 indirect_illumination_term = calculateIndirectIllumination(wo, n);

	///////////////////////////////////////////////////////////////////////////
	// Add emissive term. If emissive texture exists, sample this term.
	///////////////////////////////////////////////////////////////////////////
	vec3 emission_term = material_emission * material_color;
	if(has_emission_texture == 1)
	{
		emission_term = texture(emissiveMap, texCoord).xyz;
	}

	vec3 shading = direct_illumination_term + indirect_illumination_term + emission_term;

	fragmentColor = vec4(shading, 1.0);
	return;
}
