import { supabase } from './supabase';

export const uploadOrderImage = async (orderId, userId, file, imageType = 'other', description = '') => {
  if (!file) return null;

  // Validate file
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file');
  }
  if (file.size > 5 * 1024 * 1024) { // 5MB limit
    throw new Error('Image size must be less than 5MB');
  }

  try {
    // Upload to storage
    const fileName = `${orderId}/${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
    const { data, error: uploadError } = await supabase.storage
      .from('order-images')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('order-images')
      .getPublicUrl(fileName);

    // Insert metadata into order_images table
    const { error: insertError } = await supabase.from('order_images').insert({
      order_id: orderId,
      uploaded_by: userId,
      image_url: publicUrl,
      description,
      image_type: imageType,
    });

    if (insertError) throw insertError;

    return { url: publicUrl, fileName };
  } catch (e) {
    throw new Error(`Upload failed: ${e.message}`);
  }
};

export const deleteOrderImage = async (fileName) => {
  const { error } = await supabase.storage
    .from('order-images')
    .remove([fileName]);

  if (error) throw error;
};
