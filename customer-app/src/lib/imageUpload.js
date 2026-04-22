import { supabase } from './supabase';

export const uploadOrderImage = async (orderId, userId, file, imageType = 'other', description = '') => {
  if (!file) return null;

  // Validate file
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file');
  }
  if (file.size > 5 * 1024 * 1024) { // 5MB limit
    throw new Error('Image must be less than 5MB');
  }

  try {
    // Create unique file path
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const ext = file.name.split('.').pop();
    const fileName = `${orderId}/${timestamp}-${random}.${ext}`;

    // Upload to storage with retry
    const { data, error: uploadError } = await supabase.storage
      .from('order-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('order-images')
      .getPublicUrl(fileName);

    // Only insert metadata if order exists
    if (orderId && !orderId.startsWith('temp-')) {
      const { error: insertError } = await supabase.from('order_images').insert({
        order_id: orderId,
        uploaded_by: userId,
        image_url: publicUrl,
        description,
        image_type: imageType,
      });

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }
    }

    return { url: publicUrl, fileName, file };
  } catch (e) {
    console.error('Upload error:', e);
    throw new Error(`Upload failed: ${e.message}`);
  }
};

export const uploadImageForOrder = async (orderId, userId, imageData, imageType = 'other') => {
  if (!imageData.fileName || !imageData.url) return null;

  try {
    // Insert metadata into order_images table for existing order
    const { error } = await supabase.from('order_images').insert({
      order_id: orderId,
      uploaded_by: userId,
      image_url: imageData.url,
      image_type: imageType,
    });

    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Error linking image to order:', e);
    throw e;
  }
};

export const deleteOrderImage = async (fileName) => {
  try {
    const { error } = await supabase.storage
      .from('order-images')
      .remove([fileName]);

    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Delete error:', e);
    throw e;
  }
};
