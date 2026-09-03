import { getProperties, getPosts } from "@/lib/wp-api";

export default async function sitemap() {
  const baseUrl = 'https://alsasa.co';

  // Rutas estáticas principales
  const routes = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/nosotros`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];

  // Rutas dinámicas de propiedades
  const properties = await getProperties() || [];
  const propertyRoutes = properties.map((property) => ({
    url: `${baseUrl}/propiedad/${property.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // Rutas dinámicas del blog
  const posts = await getPosts() || [];
  const postRoutes = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(), // Evitar error de parseo de fecha localizada en español
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...routes, ...propertyRoutes, ...postRoutes];
}
