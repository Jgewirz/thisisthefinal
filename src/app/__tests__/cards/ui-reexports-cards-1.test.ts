import { describe, it, expect } from 'vitest';

import { ColorSeasonCard as AppColorSeasonCard } from '../../components/cards/ColorSeasonCard';
import { FitnessClassCard as AppFitnessClassCard } from '../../components/cards/FitnessClassCard';
import { FlightCard as AppFlightCard } from '../../components/cards/FlightCard';
import { PlaceCard as AppPlaceCard } from '../../components/cards/PlaceCard';
import { ClassListCard as AppClassListCard } from '../../components/cards/ClassListCard';
import { PlacesListCard as AppPlacesListCard } from '../../components/cards/PlacesListCard';
import { FlightListCard as AppFlightListCard } from '../../components/cards/FlightListCard';
import { HotelListCard as AppHotelListCard } from '../../components/cards/HotelListCard';

import { ColorSeasonCard as UiColorSeasonCard } from '../../../ui/components/cards/ColorSeasonCard';
import { FitnessClassCard as UiFitnessClassCard } from '../../../ui/components/cards/FitnessClassCard';
import { FlightCard as UiFlightCard } from '../../../ui/components/cards/FlightCard';
import { PlaceCard as UiPlaceCard } from '../../../ui/components/cards/PlaceCard';
import { ClassListCard as UiClassListCard } from '../../../ui/components/cards/ClassListCard';
import { PlacesListCard as UiPlacesListCard } from '../../../ui/components/cards/PlacesListCard';
import { FlightListCard as UiFlightListCard } from '../../../ui/components/cards/FlightListCard';
import { HotelListCard as UiHotelListCard } from '../../../ui/components/cards/HotelListCard';

describe('Card UI re-export stubs (batch 1)', () => {
  it('keeps ColorSeasonCard wired to src/ui', () => {
    expect(AppColorSeasonCard).toBe(UiColorSeasonCard);
  });

  it('keeps FitnessClassCard wired to src/ui', () => {
    expect(AppFitnessClassCard).toBe(UiFitnessClassCard);
  });

  it('keeps FlightCard wired to src/ui', () => {
    expect(AppFlightCard).toBe(UiFlightCard);
  });

  it('keeps PlaceCard wired to src/ui', () => {
    expect(AppPlaceCard).toBe(UiPlaceCard);
  });

  it('keeps ClassListCard wired to src/ui', () => {
    expect(AppClassListCard).toBe(UiClassListCard);
  });

  it('keeps PlacesListCard wired to src/ui', () => {
    expect(AppPlacesListCard).toBe(UiPlacesListCard);
  });

  it('keeps FlightListCard wired to src/ui', () => {
    expect(AppFlightListCard).toBe(UiFlightListCard);
  });

  it('keeps HotelListCard wired to src/ui', () => {
    expect(AppHotelListCard).toBe(UiHotelListCard);
  });
});
