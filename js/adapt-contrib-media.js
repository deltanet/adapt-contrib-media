import components from 'core/js/components';
import MediaAutoplayView from './mediaView';
import MediaAutoplayModel from './mediaModel';

export default components.register('media-autoplay', {
  model: MediaAutoplayModel,
  view: MediaAutoplayView
});
