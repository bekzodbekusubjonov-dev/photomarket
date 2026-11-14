/** Bosh sahifa yo'nalish plitkalari. Rasmlar backend /api/site orqali keladi (backend/app/images.py). */
export const CATEGORIES: { name: string; slot: string; hint: string }[] = [
  { name: "To'y", slot: "cat_wedding", hint: "Kun bo'yi syomka, albom" },
  { name: "Love story", slot: "cat_love", hint: "Sayr va kino-kadrlar" },
  { name: "Portret", slot: "cat_portrait", hint: "Studiya va ko'cha" },
  { name: "Oilaviy", slot: "cat_family", hint: "Oila xotirasi uchun" },
  { name: "Bolalar", slot: "cat_kids", hint: "Tug'ilgan kun, bog'cha" },
  { name: "Korporativ", slot: "cat_corporate", hint: "Tadbir va konferensiya" },
  { name: "Mahsulot (predmet)", slot: "cat_product", hint: "Marketplace va SMM" },
  { name: "Tadbir / konsert", slot: "cat_event", hint: "Sahna va reportaj" },
];
