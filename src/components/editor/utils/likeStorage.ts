import { getSupabase } from './supabase';

export const likeStorage = {
  async getUserLikes(): Promise<string[]> {
    const supabase = await getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('template_likes')
      .select('template_id')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching user likes:', error);
      return [];
    }

    return (data || []).map((row) => row.template_id);
  },

  async toggleLike(templateId: string): Promise<{ liked: boolean }> {
    const supabase = await getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { data: existing } = await supabase
      .from('template_likes')
      .select('id')
      .eq('template_id', templateId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('template_likes')
        .delete()
        .eq('template_id', templateId)
        .eq('user_id', user.id);

      if (error) throw error;
      return { liked: false };
    }

    const { error } = await supabase
      .from('template_likes')
      .insert({ template_id: templateId, user_id: user.id });

    if (error) throw error;
    return { liked: true };
  },
};
