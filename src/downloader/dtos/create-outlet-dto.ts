export class CreateOutletDto {
  merchant_id: string;
  name: string;
  description: string;
  rating: number;
  price_level: number;
  website: string;
  formatted_phone_number: string;
  international_phone_number: string;
  types: string[];
  business_status: string;
  google_icon: string;
  icon_background_color: string;
  icon_mask_base_uri: string;
  food_serves: string[];
  reviews: JSON[];
  user_ratings_total: number;
}