import Adapt from 'core/js/adapt';
import MediaAutoplayView from './mediaAutoplayView';
import MediaAutoplayModel from './mediaAutoplayModel';

export default Adapt.register('media-autoplay', {
  model: MediaAutoplayModel,
  view: MediaAutoplayView
});
